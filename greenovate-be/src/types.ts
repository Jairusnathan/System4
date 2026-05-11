export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  images?: string[];
  specifications?: Record<string, string>;
  stock?: number;
}

export interface SavedAddress {
  fullName: string;
  phoneNumber: string;
  province: string;
  city: string;
  postalCode: string;
  streetAddress: string;
  label: 'Home' | 'Work';
}
