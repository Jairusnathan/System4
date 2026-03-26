import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyAccessToken } from '../../../../../lib/auth';
import { SavedAddress, stringifyAddresses } from '@/lib/customer-addresses';

export async function GET(request: Request) {
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

    const { data: user, error: fetchError } = await supabase
      .from('customers')
      .select('id, full_name, email, phone, birthday, gender, address')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: addressRows, error: addressesError } = await supabase
      .from('customer_addresses')
      .select('full_name, phone_number, province, city, postal_code, street_address, label, is_default, sort_order, created_at')
      .eq('customer_id', userId)
      .order('is_default', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (addressesError) {
      console.error('Fetch customer addresses error:', addressesError);
      return NextResponse.json(user);
    }

    if (addressRows && addressRows.length > 0) {
      const serializedAddresses = stringifyAddresses(
        addressRows.map(
          (entry): SavedAddress => ({
            fullName: entry.full_name || '',
            phoneNumber: entry.phone_number || '',
            province: entry.province || '',
            city: entry.city || '',
            postalCode: entry.postal_code || '',
            streetAddress: entry.street_address || '',
            label: entry.label === 'Work' ? 'Work' : 'Home',
          })
        )
      );

      return NextResponse.json({
        ...user,
        address: serializedAddresses,
      });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
