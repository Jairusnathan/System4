'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Package, MapPin, LogOut, ChevronRight, Clock, CheckCircle2, Truck, X, Settings, Bell, Lock, Calendar, Phone, Mail, Camera, ArrowLeft, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  ensureAccessToken,
  fetchWithAuth,
} from '@/lib/auth-client';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { normalizeDateForInput, normalizeDateForStorage } from '@/lib/date';
import { normalizePhilippinePhone, PH_PHONE_MESSAGE } from '@/lib/phone';

const ADDRESS_STORAGE_PREFIX = '__addresses_json__:';

type SavedAddress = {
  fullName: string;
  phoneNumber: string;
  province: string;
  city: string;
  postalCode: string;
  streetAddress: string;
  label: 'Home' | 'Work';
};

const createEmptyAddress = (user?: { full_name?: string; phone?: string } | null): SavedAddress => ({
  fullName: user?.full_name || '',
  phoneNumber: user?.phone || '',
  province: '',
  city: '',
  postalCode: '',
  streetAddress: '',
  label: 'Home',
});

const formatAddressPreview = (address: SavedAddress) =>
  [address.streetAddress, address.city, address.province, address.postalCode].filter(Boolean).join(', ');

const parseAddresses = (
  address?: string,
  user?: { full_name?: string; phone?: string } | null
): SavedAddress[] => {
  if (!address) {
    return [];
  }

  if (address.startsWith(ADDRESS_STORAGE_PREFIX)) {
    try {
      const parsed = JSON.parse(address.slice(ADDRESS_STORAGE_PREFIX.length));
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          return [];
        }

        return parsed.map((entry) => {
          const legacyLocation = typeof entry?.location === 'string' ? entry.location : '';
          const [legacyProvince = '', legacyCity = ''] = legacyLocation.split(',').map((item: string) => item.trim());
          const normalizedEntryPhone = normalizePhilippinePhone(entry?.phoneNumber || '');
          const normalizedUserPhone = normalizePhilippinePhone(user?.phone || '');

          return {
            fullName: entry?.fullName || user?.full_name || '',
            phoneNumber: normalizedEntryPhone || normalizedUserPhone || entry?.phoneNumber || user?.phone || '',
            province: entry?.province || entry?.region || legacyProvince,
            city: entry?.city || legacyCity,
            postalCode: entry?.postalCode || '',
            streetAddress: entry?.streetAddress || '',
            label: entry?.label === 'Work' ? 'Work' : 'Home',
          };
        });
      }
    } catch (error) {
      console.error('Failed to parse saved addresses:', error);
    }
  }

  return [
    {
      ...createEmptyAddress(user),
      streetAddress: address,
    },
  ];
};

const stringifyAddresses = (addresses: SavedAddress[]) =>
  `${ADDRESS_STORAGE_PREFIX}${JSON.stringify(addresses)}`;

const MAX_SAVED_ADDRESSES = 4;

const PROVINCE_OPTIONS = [
  'Abra',
  'Agusan Del Norte',
  'Agusan Del Sur',
  'Aklan',
  'Albay',
  'Antique',
  'Apayao',
  'Aurora',
  'Basilan',
  'Bataan',
  'Batangas',
  'Benguet',
  'Biliran',
  'Bohol',
  'Bukidnon',
  'Bulacan',
  'Cagayan',
  'Camarines Norte',
  'Camarines Sur',
  'Camiguin',
  'Capiz',
  'Catanduanes',
  'Cavite',
  'Cebu',
  'Cotabato',
  'Davao Del Norte',
  'Davao Del Sur',
  'Davao de Oro',
  'Davao Occidental',
  'Davao Oriental',
  'Dinagat Islands',
  'Eastern Samar',
  'Guimaras',
  'Ifugao',
  'Ilocos Norte',
  'Ilocos Sur',
  'Iloilo',
  'Isabela',
  'Kalinga',
  'Laguna',
  'Lanao Del Norte',
  'La Union',
  'Lazada Office',
  'Leyte',
  'Maguindanao',
  'Marinduque',
  'Masbate',
  'Metro Manila',
  'Misamis Occidental',
  'Misamis Oriental',
  'Mountain Province',
  'Negros Occidental',
  'Negros Oriental',
  'North Cotabato',
  'Northern Samar',
  'Nueva Ecija',
  'Nueva Vizcaya',
  'Occidental Mindoro',
  'Oriental Mindoro',
  'Palawan',
  'Pampanga',
  'Pangasinan',
  'Quezon',
  'Quirino',
  'Rizal',
  'Romblon',
  'Sarangani',
  'Siquijor',
  'Sorsogon',
  'South Cotabato',
  'Southern Leyte',
  'Sultan Kudarat',
  'Surigao Del Norte',
  'Surigao Del Sur',
  'Tarlac',
  'Tawi-Tawi',
  'Western Samar',
  'Zambales',
  'Zamboanga Del Norte',
  'Zamboanga Del Sur',
  'Zamboanga Sibugay',
] as const;

const CITY_OPTIONS_BY_PROVINCE: Partial<Record<(typeof PROVINCE_OPTIONS)[number], readonly string[]>> = {
  'Metro Manila': [
    'Caloocan',
    'Las Pinas',
    'Makati',
    'Malabon',
    'Mandaluyong',
    'Manila',
    'Marikina',
    'Muntinlupa',
    'Navotas',
    'Paranaque',
    'Pasay',
    'Pasig',
    'Pateros',
    'Quezon City',
    'San Juan',
    'Taguig',
    'Valenzuela',
  ],
};

export default function Account() {
  const { 
    orders, setSelectedOrder, setView,
    setIsLoggedIn, user, setUser
  } = useAppContext();

  const [subView, setSubView] = useState<'profile' | 'addresses' | 'orders' | 'settings'>('profile');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isProvincePickerOpen, setIsProvincePickerOpen] = useState(false);
  const [isCityPickerOpen, setIsCityPickerOpen] = useState(false);
  const [makeAddressDefault, setMakeAddressDefault] = useState(false);
  const [addressValidationMessage, setAddressValidationMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [addressEntries, setAddressEntries] = useState<SavedAddress[]>(parseAddresses(user?.address, user));
  const [addressFormData, setAddressFormData] = useState<SavedAddress>(createEmptyAddress(user));
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);

  const [profileData, setProfileData] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    birthday: normalizeDateForInput(user?.birthday || user?.dob),
    address: user?.address || '',
    profileImage: user?.profile_image || '',
    profileImageTouched: false
  });

  const cityOptions = addressFormData.province
    ? CITY_OPTIONS_BY_PROVINCE[addressFormData.province as keyof typeof CITY_OPTIONS_BY_PROVINCE] || [addressFormData.province]
    : [];

  React.useEffect(() => {
    if (user) {
      const parsedAddresses = parseAddresses(user.address, user);

      setProfileData({
        fullName: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        birthday: normalizeDateForInput(user.birthday || user.dob),
        address: stringifyAddresses(parsedAddresses),
        profileImage: user.profile_image || '',
        profileImageTouched: false
      });
      setAddressEntries(parsedAddresses);
      setIsEditingProfile(false);
      setEditingAddressIndex(null);
      setAddressFormData(createEmptyAddress(user));
      setMakeAddressDefault(false);
      setAddressValidationMessage('');
      setIsProvincePickerOpen(false);
      setIsCityPickerOpen(false);
    }
  }, [user]);

  React.useEffect(() => {
    setProfileData((prev) => ({
      ...prev,
      address: stringifyAddresses(addressEntries),
    }));
  }, [addressEntries]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveStatus({ type: null, message: '' });
    try {
      const normalizedPhone = profileData.phone
        ? normalizePhilippinePhone(profileData.phone)
        : null;

      if (profileData.phone && !normalizedPhone) {
        setSaveStatus({ type: 'error', message: PH_PHONE_MESSAGE });
        return;
      }

      const res = await fetchWithAuth('/api/auth/update-profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: profileData.fullName,
          phone: normalizedPhone,
          birthday: normalizeDateForStorage(profileData.birthday),
          address: profileData.address,
          profile_image: profileData.profileImageTouched
            ? profileData.profileImage || null
            : user?.profile_image || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setIsEditingProfile(false);
        setSaveStatus({ type: 'success', message: 'Profile updated successfully!' });
        setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
      } else {
        setSaveStatus({ type: 'error', message: data.error || 'Failed to update profile' });
      }
    } catch (error) {
      setSaveStatus({ type: 'error', message: 'An error occurred' });
    } finally {
      setIsSaving(false);
    }
  };

  const persistAddresses = async (nextAddresses: SavedAddress[], successMessage = 'Addresses updated successfully!') => {
    setIsSaving(true);
    setSaveStatus({ type: null, message: '' });

    try {
      if (nextAddresses.length > MAX_SAVED_ADDRESSES) {
        setSaveStatus({ type: 'error', message: `You can only save up to ${MAX_SAVED_ADDRESSES} addresses.` });
        return false;
      }

      const normalizedPhone = profileData.phone
        ? normalizePhilippinePhone(profileData.phone)
        : null;

      if (profileData.phone && !normalizedPhone) {
        setSaveStatus({ type: 'error', message: PH_PHONE_MESSAGE });
        return false;
      }

      const normalizedAddresses = nextAddresses.map((entry) => ({
        ...entry,
        fullName: entry.fullName || profileData.fullName,
        phoneNumber: normalizePhilippinePhone(entry.phoneNumber) || normalizedPhone || '',
      }));

      const hasInvalidAddressPhone = normalizedAddresses.some((entry) => !normalizePhilippinePhone(entry.phoneNumber));

      if (hasInvalidAddressPhone) {
        setSaveStatus({ type: 'error', message: PH_PHONE_MESSAGE });
        return false;
      }

      const sanitizedAddresses = normalizedAddresses.map((entry) => ({
        ...entry,
        phoneNumber: normalizePhilippinePhone(entry.phoneNumber) || entry.phoneNumber,
      }));
      const cleanedAddressValue = stringifyAddresses(sanitizedAddresses);
      const res = await fetchWithAuth('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: profileData.fullName,
          phone: normalizedPhone,
          birthday: normalizeDateForStorage(profileData.birthday),
          address: cleanedAddressValue
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveStatus({ type: 'error', message: data.error || 'Failed to update profile' });
        return false;
      }

      setAddressEntries(parseAddresses(cleanedAddressValue, data));
      setUser(data);
      setEditingAddressIndex(null);
      setIsAddressModalOpen(false);
      setIsProvincePickerOpen(false);
      setIsCityPickerOpen(false);
      setSaveStatus({ type: 'success', message: successMessage });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
      return true;
    } catch (error) {
      setSaveStatus({ type: 'error', message: 'An error occurred' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: true
  });
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordStatus, setPasswordStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useBodyScrollLock(isAddressModalOpen || isLogoutModalOpen || isPasswordModalOpen);

  const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setSaveStatus({ type: 'error', message: 'Please choose a valid image file.' });
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setSaveStatus({ type: 'error', message: 'Profile picture must be 2MB or smaller.' });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setProfileData((prev) => ({
        ...prev,
        profileImage: result,
        profileImageTouched: true,
      }));
      setIsEditingProfile(true);
      setSaveStatus({ type: 'success', message: 'Profile picture selected. Click Save Changes to keep it.' });
    };

    reader.onerror = () => {
      setSaveStatus({ type: 'error', message: 'Unable to read that image. Please try another one.' });
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleRemoveProfileImage = () => {
    setProfileData((prev) => ({
      ...prev,
      profileImage: '',
      profileImageTouched: true,
    }));
    setIsEditingProfile(true);
    setSaveStatus({ type: 'success', message: 'Profile picture removed. Click Save Changes to update your account.' });
  };

  const profileImageSrc = profileData.profileImageTouched
    ? profileData.profileImage
    : user?.profile_image || '';

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsLogoutModalOpen(false);
  };

  const renderProfileDetails = () => (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-slate-100 bg-slate-50/70 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <input
                ref={profileImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileImageChange}
              />
              <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-emerald-100 text-emerald-600 shadow-md shadow-slate-200/70 sm:h-32 sm:w-32">
                {profileImageSrc ? (
                  <img
                    src={profileImageSrc}
                    alt={user?.full_name || 'Profile'}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User className="w-12 h-12" />
                  </div>
                )}
              </div>
              {isEditingProfile && (
                <button
                  type="button"
                  onClick={() => profileImageInputRef.current?.click()}
                  className="absolute bottom-0 right-0 rounded-full bg-emerald-600 p-2 text-white shadow-lg transition-colors hover:bg-emerald-700"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                Profile
              </p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">
                Hi, {user?.full_name || 'Guest User'}!
              </h3>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Welcome back to PharmaQuick.
              </p>

              {isEditingProfile && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-500">
                    Upload a new profile picture. Max size 2MB.
                  </p>
                  {profileImageSrc && (
                    <button
                      type="button"
                      onClick={handleRemoveProfileImage}
                      className="mt-3 text-sm font-bold text-red-500 transition-colors hover:text-red-600"
                    >
                      Remove picture
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {!isEditingProfile ? (
            <button
              onClick={() => {
                setSaveStatus({ type: null, message: '' });
                setIsEditingProfile(true);
              }}
              className="inline-flex items-center justify-center self-start rounded-full bg-emerald-600 px-8 py-3 font-black text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700 lg:self-center"
            >
              Edit Profile
            </button>
          ) : (
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button
                onClick={() => {
                  setProfileData({
                    fullName: user?.full_name || '',
                    email: user?.email || '',
                    phone: user?.phone || '',
                    birthday: normalizeDateForInput(user?.birthday || user?.dob),
                    address: user?.address || '',
                    profileImage: user?.profile_image || '',
                    profileImageTouched: false
                  });
                  setAddressEntries(parseAddresses(user?.address, user));
                  setSaveStatus({ type: null, message: '' });
                  setIsEditingProfile(false);
                }}
                className="rounded-full border-2 border-slate-200 bg-white px-6 py-3 font-black text-slate-700 transition-all hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-10 py-3 font-black text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700 disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <Clock className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
          <input 
            type="text"
            value={profileData.fullName}
            onChange={(e) => setProfileData({...profileData, fullName: e.target.value})}
            readOnly={!isEditingProfile}
            className={`w-full px-4 py-3 border rounded-xl transition-all font-medium ${
              isEditingProfile
                ? 'bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                : 'bg-slate-50 border-slate-100 text-slate-700 cursor-default'
            }`}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
          <input 
            type="email"
            value={profileData.email}
            readOnly
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-medium text-slate-700 cursor-default"
          />
          <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Email can’t be edited here</p>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number</label>
          <input 
            type="tel"
            value={profileData.phone}
            onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
            readOnly={!isEditingProfile}
            placeholder="09123456789 or +639123456789"
            className={`w-full px-4 py-3 border rounded-xl transition-all font-medium ${
              isEditingProfile
                ? 'bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                : 'bg-slate-50 border-slate-100 text-slate-700 cursor-default'
            }`}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Date of Birth</label>
          <div className="relative">
            <input 
              type="date"
              value={profileData.birthday}
              onChange={(e) => setProfileData({...profileData, birthday: e.target.value})}
              readOnly={!isEditingProfile}
              className={`w-full px-4 py-3 border rounded-xl transition-all font-medium ${
                isEditingProfile
                  ? 'bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                  : 'bg-slate-50 border-slate-100 text-slate-700 cursor-default'
              }`}
            />
          </div>
        </div>
      </div>

      {saveStatus.type && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold ${
            saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
          }`}
        >
          {saveStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {saveStatus.message}
        </motion.div>
      )}

    </div>
  );

  const renderAddresses = () => (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight">My Addresses</h3>
          <p className="text-sm text-slate-500 mt-2">Manage your saved delivery addresses and choose which one should be the default.</p>
        </div>
        <button
          type="button"
          disabled={isSaving || addressEntries.length >= MAX_SAVED_ADDRESSES}
          onClick={() => {
            setEditingAddressIndex(addressEntries.length);
            setAddressFormData(createEmptyAddress({
              full_name: profileData.fullName,
              phone: profileData.phone,
            }));
            setMakeAddressDefault(addressEntries.length === 0);
            setIsAddressModalOpen(true);
            setAddressValidationMessage('');
            setIsProvincePickerOpen(false);
            setIsCityPickerOpen(false);
            setSaveStatus({ type: null, message: '' });
          }}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-black hover:bg-orange-600 transition-all disabled:opacity-70"
        >
          <span className="text-xl leading-none">+</span>
          Add New Address
        </button>
      </div>

      {addressEntries.length >= MAX_SAVED_ADDRESSES && (
        <p className="text-sm font-bold text-slate-500">You can only save up to 4 addresses.</p>
      )}

      <div className="divide-y divide-slate-200 rounded-[2rem] border border-slate-200 bg-white overflow-hidden">
        {addressEntries.length === 0 && (
          <div className="p-8 sm:p-10">
            <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
              <p className="text-2xl font-black text-slate-900">No saved addresses yet</p>
              <p className="mt-2 text-sm text-slate-500">Add a delivery address to make checkout faster next time.</p>
            </div>
          </div>
        )}

        {addressEntries.map((address, index) => {
          const isDefault = index === 0;

          return (
            <div key={index} className="p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-2xl font-black text-slate-900 mb-3">Address</h4>
                  <p className="text-lg font-black text-slate-900">{address.fullName || profileData.fullName || 'Your Name'}</p>
                  <p className="text-base text-slate-500 mb-3">{address.phoneNumber || profileData.phone || 'Add your phone number in Profile Details'}</p>
                  <p className="text-base leading-7 text-slate-600 max-w-3xl whitespace-pre-line">
                    {formatAddressPreview(address) || 'No address saved yet.'}
                  </p>

                  {isDefault && (
                    <span className="inline-flex items-center px-3 py-1 mt-4 border border-orange-400 text-orange-500 text-sm font-bold rounded-sm">
                      Default
                    </span>
                  )}
                </div>

                <div className="flex flex-row flex-wrap gap-3 lg:flex-col lg:items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAddressIndex(index);
                      setAddressFormData(address);
                      setMakeAddressDefault(index === 0);
                      setIsAddressModalOpen(true);
                      setAddressValidationMessage('');
                      setIsProvincePickerOpen(false);
                      setIsCityPickerOpen(false);
                      setSaveStatus({ type: null, message: '' });
                    }}
                    className="text-lg font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Edit
                  </button>

                  {!isDefault && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={async () => {
                        const nextAddresses = [addressEntries[index], ...addressEntries.filter((_, entryIndex) => entryIndex !== index)];
                        await persistAddresses(nextAddresses, 'Default address updated successfully!');
                      }}
                      className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition-colors disabled:opacity-70"
                    >
                      Set as default
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={async () => {
                      const nextAddresses = addressEntries.filter((_, entryIndex) => entryIndex !== index);
                      await persistAddresses(nextAddresses, 'Address deleted successfully!');
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-70"
                    aria-label="Delete address"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {saveStatus.type && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold ${
            saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
          }`}
        >
          {saveStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {saveStatus.message}
        </motion.div>
      )}

      <AnimatePresence>
        {isAddressModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isSaving) {
                  setIsAddressModalOpen(false);
                  setEditingAddressIndex(null);
                  setAddressValidationMessage('');
                }
              }}
              className="fixed inset-0 bg-slate-900/35 z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 24 }}
              className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]"
            >
              <div className="p-5 sm:p-8">
                <div className="mb-7 border-b border-slate-100 pb-5">
                  <h3 className="text-3xl font-black tracking-tight text-slate-900 sm:text-[2.2rem]">Edit Address</h3>
                  <p className="mt-2 text-sm text-slate-500">Update your delivery details and keep this address ready for checkout.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">
                  <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-orange-400 focus-within:bg-white focus-within:shadow-orange-100">
                    <label className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Full Name</label>
                    <input
                      type="text"
                      value={addressFormData.fullName}
                      onChange={(e) => setAddressFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                      className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none sm:text-lg"
                    />
                  </div>
                  <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-orange-400 focus-within:bg-white focus-within:shadow-orange-100">
                    <label className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Phone Number</label>
                    <input
                      type="text"
                      value={addressFormData.phoneNumber}
                      onChange={(e) => setAddressFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                      placeholder="09123456789 or +639123456789"
                      className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none sm:text-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">
                  <div className="relative">
                    <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-orange-400 focus-within:bg-white focus-within:shadow-orange-100">
                      <label className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Province</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProvincePickerOpen((prev) => !prev);
                          setIsCityPickerOpen(false);
                        }}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <input
                          type="text"
                          readOnly
                          value={addressFormData.province}
                          placeholder="Select province"
                          className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-300 sm:text-lg"
                        />
                        <span className={`text-slate-400 text-xl transition-transform ${isProvincePickerOpen ? 'rotate-180' : ''}`}>▾</span>
                      </button>
                    </div>

                    {isProvincePickerOpen && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-2 py-2 text-left text-base text-slate-700 shadow-xl shadow-slate-200/60">
                        {PROVINCE_OPTIONS.map((province) => (
                          <button
                            key={province}
                            type="button"
                            onClick={() => {
                              setAddressFormData((prev) => ({
                                ...prev,
                                province,
                                city: CITY_OPTIONS_BY_PROVINCE[province]?.includes(prev.city) ? prev.city : '',
                              }));
                              setIsProvincePickerOpen(false);
                            }}
                            className={`block w-full rounded-xl px-3 py-2 text-left font-medium transition-colors ${addressFormData.province === province ? 'bg-orange-50 text-orange-600' : 'hover:bg-slate-50'}`}
                          >
                            {province}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-orange-400 focus-within:bg-white focus-within:shadow-orange-100">
                      <label className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">City</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCityPickerOpen((prev) => !prev);
                          setIsProvincePickerOpen(false);
                        }}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <input
                          type="text"
                          readOnly
                          value={addressFormData.city}
                          placeholder="Select city"
                          className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-300 sm:text-lg"
                        />
                        <span className={`text-slate-400 text-xl transition-transform ${isCityPickerOpen ? 'rotate-180' : ''}`}>▾</span>
                      </button>
                    </div>

                    {isCityPickerOpen && cityOptions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-2 py-2 text-left text-base text-slate-700 shadow-xl shadow-slate-200/60">
                        {cityOptions.map((city) => (
                          <button
                            key={city}
                            type="button"
                            onClick={() => {
                              setAddressFormData((prev) => ({ ...prev, city }));
                              setIsCityPickerOpen(false);
                            }}
                            className={`block w-full rounded-xl px-3 py-2 text-left font-medium transition-colors ${addressFormData.city === city ? 'bg-orange-50 text-orange-600' : 'hover:bg-slate-50'}`}
                          >
                            {city}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative mb-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-orange-400 focus-within:bg-white focus-within:shadow-orange-100">
                  <label className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Postal Code</label>
                  <input
                    type="text"
                    value={addressFormData.postalCode}
                    onChange={(e) => setAddressFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
                    className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none sm:text-lg"
                  />
                </div>

                <div className="relative mb-8 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-orange-400 focus-within:bg-white focus-within:shadow-orange-100">
                  <label className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Street Name, Building, House No.</label>
                  <textarea
                    rows={4}
                    value={addressFormData.streetAddress}
                    onChange={(e) => setAddressFormData((prev) => ({ ...prev, streetAddress: e.target.value }))}
                    className="w-full resize-none bg-transparent text-base font-semibold text-slate-800 outline-none sm:text-lg"
                  />
                </div>

                <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-700 transition-colors hover:border-slate-300 hover:bg-white">
                  <input
                    type="checkbox"
                    checked={makeAddressDefault}
                    onChange={(e) => setMakeAddressDefault(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">Make this my default address</span>
                    <span className="block text-sm text-slate-500">This address will be selected first during checkout.</span>
                  </span>
                </label>

                <div className="flex flex-col gap-6 border-t border-slate-100 pt-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Label As</p>
                    <div className="flex gap-3">
                      {(['Home', 'Work'] as const).map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setAddressFormData((prev) => ({ ...prev, label }))}
                          className={`rounded-2xl px-6 py-3 text-base font-bold transition-all sm:text-lg ${
                            addressFormData.label === label
                              ? 'border border-orange-500 bg-orange-50 text-orange-600 shadow-sm shadow-orange-100'
                              : 'border border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddressModalOpen(false);
                        setEditingAddressIndex(null);
                        setMakeAddressDefault(false);
                        setAddressValidationMessage('');
                        setIsProvincePickerOpen(false);
                        setIsCityPickerOpen(false);
                      }}
                      className="rounded-2xl border border-slate-200 px-6 py-3 text-base font-bold text-slate-600 transition-colors hover:bg-slate-50 sm:text-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={async () => {
                        const missingFields = [
                          !addressFormData.fullName.trim() ? 'Full Name' : null,
                          !addressFormData.phoneNumber.trim() ? 'Phone Number' : null,
                          !addressFormData.streetAddress.trim() ? 'Street Name, Building, House No.' : null,
                        ].filter(Boolean);

                        if (missingFields.length > 0) {
                          setAddressValidationMessage(`Please fill in the following before submitting: ${missingFields.join(', ')}.`);
                          return;
                        }

                          const normalizedAddressPhone = normalizePhilippinePhone(addressFormData.phoneNumber);

                          if (!normalizedAddressPhone) {
                            setAddressValidationMessage(PH_PHONE_MESSAGE);
                            return;
                          }

                          const nextAddresses = [...addressEntries];
                          const targetIndex = editingAddressIndex ?? nextAddresses.length;
                          nextAddresses[targetIndex] = {
                            ...addressFormData,
                            phoneNumber: normalizedAddressPhone,
                          };
                        let orderedAddresses = [...nextAddresses];

                        if (makeAddressDefault) {
                          const [selectedAddress] = orderedAddresses.splice(targetIndex, 1);
                          orderedAddresses = selectedAddress ? [selectedAddress, ...orderedAddresses] : orderedAddresses;
                        } else if (targetIndex === 0 && orderedAddresses.length > 1) {
                          const [selectedAddress] = orderedAddresses.splice(0, 1);
                          orderedAddresses = selectedAddress
                            ? [orderedAddresses[0], selectedAddress, ...orderedAddresses.slice(1)]
                            : orderedAddresses;
                        }

                        const success = await persistAddresses(orderedAddresses, 'Address saved successfully!');
                        if (success) {
                          setAddressFormData(createEmptyAddress(user));
                          setMakeAddressDefault(false);
                        }
                      }}
                      className="rounded-2xl bg-orange-500 px-8 py-3 text-base font-bold text-white shadow-lg shadow-orange-200 transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70 sm:text-lg"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            <AnimatePresence>
              {addressValidationMessage && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[60] bg-slate-900/30"
                    onClick={() => setAddressValidationMessage('')}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 12 }}
                    className="fixed left-1/2 top-1/2 z-[61] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-amber-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                        <X className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-black text-slate-900">Incomplete address details</h4>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{addressValidationMessage}</p>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setAddressValidationMessage('')}
                        className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-600"
                      >
                        Okay
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>
    </div>
  );

  const renderOrderHistory = () => (
    <div className="space-y-6">
      {orders.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-2">No orders yet</h3>
          <p className="text-slate-500 mb-8 max-w-xs mx-auto">You haven't placed any orders yet. Start shopping to see your history!</p>
          <button 
            onClick={() => setView('shop')}
            className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            Go to Shop
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => (
            <div 
              key={order.id}
              onClick={() => {
                setSelectedOrder(order);
                setView('order-status');
              }}
              className="group p-6 rounded-[2rem] border-2 border-slate-100 hover:border-emerald-200 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Order ID</p>
                  <p className="font-black text-slate-900 tracking-tight">{order.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-2 ${
                    order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 
                    order.status === 'Processing' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      order.status === 'Delivered' ? 'bg-emerald-500' : 
                      order.status === 'Processing' ? 'bg-blue-500' : 'bg-amber-500'
                    }`} />
                    {order.status}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Date</p>
                  <p className="text-sm font-bold text-slate-900">{new Date(order.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Amount</p>
                  <p className="text-sm font-black text-emerald-600">₱{order.total.toFixed(2)}</p>
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Items</p>
                  <p className="text-sm font-bold text-slate-900">{order.items.length} Product{order.items.length > 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAccountSettings = () => (
    <div className="space-y-10">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors">
          <div>
            <h4 className="font-black text-slate-900">Email Notifications</h4>
            <p className="text-sm text-slate-500">Receive order updates and promotions</p>
          </div>
          <button 
            onClick={() => setSettings({...settings, emailNotifications: !settings.emailNotifications})}
            className={`w-12 h-6 rounded-full transition-all relative ${settings.emailNotifications ? 'bg-emerald-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.emailNotifications ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors">
          <div>
            <h4 className="font-black text-slate-900">SMS Notifications</h4>
            <p className="text-sm text-slate-500">Receive delivery updates via SMS</p>
          </div>
          <button 
            onClick={() => setSettings({...settings, smsNotifications: !settings.smsNotifications})}
            className={`w-12 h-6 rounded-full transition-all relative ${settings.smsNotifications ? 'bg-emerald-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.smsNotifications ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>

      <div className="pt-8 border-t border-slate-100">
        <h4 className="font-black text-slate-900 mb-6">Change Password</h4>
        <button 
          onClick={() => setIsPasswordModalOpen(true)}
          className="px-6 py-2.5 bg-white border-2 border-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all font-black"
        >
          Update Password
        </button>
      </div>
    </div>
  );

  return (
    <main className="flex-1 py-8 sm:py-12">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <button 
          onClick={() => setView('shop')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold mb-8 group transition-colors"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Shop
        </button>

        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-12">My Account</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* User Info Card */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-16 h-16 overflow-hidden rounded-full border-2 border-white bg-emerald-100 text-emerald-600 shadow-sm shrink-0">
                      {profileImageSrc ? (
                        <img
                          src={profileImageSrc}
                          alt={user?.full_name || 'Profile'}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <User className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 leading-tight">{user?.full_name || 'Guest User'}</h3>
                      <p className="text-sm text-slate-500 font-medium">{user?.email || 'Not logged in'}</p>
                    </div>
            </div>

            {/* Menu Card */}
            <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="space-y-1">
                {[
                  { id: 'profile', name: 'Profile Details', icon: <User className="w-5 h-5" /> },
                  { id: 'addresses', name: 'Addresses', icon: <MapPin className="w-5 h-5" /> },
                  { id: 'orders', name: 'Order History', icon: <Package className="w-5 h-5" /> },
                  { id: 'settings', name: 'Account Settings', icon: <Settings className="w-5 h-5" /> }
                ].map(item => (
                  <button 
                    key={item.id}
                    onClick={() => setSubView(item.id as any)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl font-bold text-sm transition-all group ${
                      subView === item.id 
                        ? 'bg-emerald-50 text-emerald-600 border-l-4 border-emerald-600 rounded-l-none' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      {item.name}
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${subView === item.id ? 'text-emerald-600 translate-x-1' : 'text-slate-300'}`} />
                  </button>
                ))}
                
                <div className="pt-4 mt-4 border-t border-slate-50">
                  <button 
                    onClick={() => setIsLogoutModalOpen(true)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl font-bold text-sm text-red-500 hover:bg-red-50 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    Log Out
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-8">
            <motion.div 
              key={subView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[600px]"
            >
              {subView !== 'addresses' && (
                <h2 className="text-2xl font-black text-slate-900 mb-10 tracking-tight">
                  {subView === 'profile' ? 'Profile Details' : subView === 'orders' ? 'Order History' : 'Account Settings'}
                </h2>
              )}
              
              {subView === 'profile' && renderProfileDetails()}
              {subView === 'addresses' && renderAddresses()}
              {subView === 'orders' && renderOrderHistory()}
              {subView === 'settings' && renderAccountSettings()}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogoutModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Log Out?</h3>
                <p className="text-slate-500 mb-6">Are you sure you want to log out of your account?</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsLogoutModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-full font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 transition-colors"
                  >
                    Log Out
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Password Update Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isUpdatingPassword) setIsPasswordModalOpen(false);
              }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 px-4"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-8 sm:p-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-100 p-3 rounded-2xl">
                      <Lock className="w-6 h-6 text-amber-600" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Update Password</h3>
                  </div>
                  <button 
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                {passwordStatus.type && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl mb-6 flex items-start gap-3 ${
                      passwordStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
                    }`}
                  >
                    {passwordStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <X className="w-5 h-5 shrink-0 mt-0.5" />}
                    <p className="text-sm font-bold">{passwordStatus.message}</p>
                  </motion.div>
                )}

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">New Password</label>
                    <input 
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                      placeholder="••••••••"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Confirm New Password</label>
                    <input 
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                      placeholder="••••••••"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                    />
                  </div>

                  <button 
                    onClick={async () => {
                      if (passwordData.newPassword !== passwordData.confirmPassword) {
                        setPasswordStatus({ type: 'error', message: 'Passwords do not match' });
                        return;
                      }
                      if (passwordData.newPassword.length < 6) {
                        setPasswordStatus({ type: 'error', message: 'Password must be at least 6 characters' });
                        return;
                      }

                      setIsUpdatingPassword(true);
                      setPasswordStatus({ type: null, message: '' });

                      try {
                        const token = await ensureAccessToken();

                        if (!token) {
                          setPasswordStatus({ type: 'error', message: 'Your session expired. Please sign in again.' });
                          return;
                        }

                        const res = await fetch('/api/auth/update-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ token, newPassword: passwordData.newPassword })
                        });

                        const data = await res.json();
                        if (res.ok) {
                          setPasswordStatus({ type: 'success', message: 'Password updated successfully!' });
                          setTimeout(() => {
                            setIsPasswordModalOpen(false);
                            setPasswordData({ newPassword: '', confirmPassword: '' });
                            setPasswordStatus({ type: null, message: '' });
                          }, 2000);
                        } else {
                          setPasswordStatus({ type: 'error', message: data.error || 'Failed to update password' });
                        }
                      } catch (err) {
                        setPasswordStatus({ type: 'error', message: 'An error occurred. Please try again.' });
                      } finally {
                        setIsUpdatingPassword(false);
                      }
                    }}
                    disabled={isUpdatingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isUpdatingPassword ? (
                      <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    ) : 'Update Password'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
