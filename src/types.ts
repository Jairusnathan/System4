export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  status: 'Processing' | 'In Transit' | 'Delivered';
  shippingAddress: string;
  paymentMethod: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  images?: string[];
  specifications?: Record<string, string>;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Branch {
  id: number;
  name: string;
  address: string;
  phone: string;
  opening_time: string;
  closing_time: string;
  is_active: boolean;
}

export interface BranchInventory {
  branch_id: number;
  product_id: string;
  stock: number;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  dob?: string;
  address?: string;
}
