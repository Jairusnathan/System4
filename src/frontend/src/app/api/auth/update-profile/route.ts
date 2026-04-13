import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizePhilippinePhone, PH_PHONE_MESSAGE } from '@/lib/phone';
import { verifyAccessToken } from '../../../../../lib/auth';
import {
  MAX_SAVED_ADDRESSES,
  normalizeSavedAddresses,
  parseSerializedAddresses,
  stringifyAddresses,
} from '@/lib/customer-addresses';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyAccessToken(token);

    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    const userId = decoded.userId as string;

    const body = await request.json();
    const { full_name, phone, birthday, gender, address, profile_image } = body;
    const normalizedPhone = phone ? normalizePhilippinePhone(phone) : null;

    if (phone && !normalizedPhone) {
      return NextResponse.json({ error: PH_PHONE_MESSAGE }, { status: 400 });
    }

    let serializedAddressValue = typeof address === 'string' ? address : undefined;
    let normalizedAddresses:
      | {
          fullName: string;
          phoneNumber: string;
          province: string;
          city: string;
          postalCode: string;
          streetAddress: string;
          label: 'Home' | 'Work';
        }[]
      | null = null;

    if (typeof address === 'string') {
      const parsedAddresses = parseSerializedAddresses(address, {
        full_name,
        phone: normalizedPhone || phone || '',
      }).filter((entry) => entry.streetAddress || entry.province || entry.city || entry.phoneNumber || entry.fullName);

      if (parsedAddresses.length > MAX_SAVED_ADDRESSES) {
        return NextResponse.json({ error: `You can only save up to ${MAX_SAVED_ADDRESSES} addresses.` }, { status: 400 });
      }

      normalizedAddresses = normalizeSavedAddresses(parsedAddresses, {
        full_name,
        phone: normalizedPhone || phone || '',
      });

      if (normalizedAddresses.some((entry) => !entry.phoneNumber)) {
        return NextResponse.json({ error: PH_PHONE_MESSAGE }, { status: 400 });
      }

      serializedAddressValue = stringifyAddresses(normalizedAddresses);
    }

    const updatePayload: {
      full_name?: string | null;
      phone?: string | null;
      birthday?: string | null;
      gender?: string | null;
      address?: string | null;
      profile_image?: string | null;
    } = {
      full_name,
      phone: normalizedPhone || null,
      birthday: birthday || null,
      gender: gender || null,
    };

    if (Object.prototype.hasOwnProperty.call(body, 'profile_image')) {
      updatePayload.profile_image =
        typeof profile_image === 'string' && profile_image.trim() ? profile_image : null;
    }

    if (typeof serializedAddressValue !== 'undefined') {
      updatePayload.address = serializedAddressValue || null;
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', userId)
      .select('id, full_name, email, phone, birthday, gender, address, profile_image')
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    if (normalizedAddresses !== null) {
      const { error: deleteAddressesError } = await supabase
        .from('customer_addresses')
        .delete()
        .eq('customer_id', userId);

      if (deleteAddressesError) {
        console.error('Delete customer addresses error:', deleteAddressesError);
        return NextResponse.json({ error: 'Failed to update addresses' }, { status: 500 });
      }

      if (normalizedAddresses.length > 0) {
        const { error: insertAddressesError } = await supabase
          .from('customer_addresses')
          .insert(
            normalizedAddresses.map((entry, index) => ({
              customer_id: userId,
              full_name: entry.fullName,
              phone_number: entry.phoneNumber,
              province: entry.province,
              city: entry.city,
              postal_code: entry.postalCode,
              street_address: entry.streetAddress,
              label: entry.label,
              is_default: index === 0,
              sort_order: index,
            }))
          );

        if (insertAddressesError) {
          console.error('Insert customer addresses error:', insertAddressesError);
          return NextResponse.json({ error: 'Failed to update addresses' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      ...updatedUser,
      address: serializedAddressValue ?? updatedUser.address,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
