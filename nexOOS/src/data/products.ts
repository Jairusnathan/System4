import { Product } from '../types';

const MEDICINE_IMAGE =
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400&h=400';
const MEDICINE_ALT_IMAGE =
  'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=400';
const FIRST_AID_IMAGE =
  'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&q=80&w=400&h=400';
const FIRST_AID_ALT_IMAGE =
  'https://images.unsplash.com/photo-1528750717929-32abb73d3bd9?auto=format&fit=crop&q=80&w=400&h=400';
const PERSONAL_CARE_IMAGE =
  'https://images.unsplash.com/photo-1559598467-f8b76c8155d0?auto=format&fit=crop&q=80&w=400&h=400';
const PERSONAL_CARE_ALT_IMAGE =
  'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&q=80&w=400&h=400';
const VITAMIN_IMAGE =
  'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&q=80&w=400&h=400';
const VITAMIN_ALT_IMAGE =
  'https://images.unsplash.com/photo-1550572017-edb95764032a?auto=format&fit=crop&q=80&w=400&h=400';

type ProductCategory = 'Medicines' | 'First Aid' | 'Personal Care' | 'Vitamins';

type ProductDraft = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  image: string;
  gallery?: string[];
  specifications: Record<string, string>;
};

const createProduct = ({
  image,
  gallery = [],
  ...product
}: ProductDraft): Product => ({
  ...product,
  image,
  images: [image, ...gallery],
});

const medicationSpecs = (
  quantity?: string,
  overrides: Record<string, string> = {}
) => ({
  Form: 'Tablet/Capsule',
  Usage: 'Follow physician instructions',
  Storage: 'Store in a cool, dry place',
  Warning: 'Keep out of reach of children',
  ...(quantity ? { Quantity: quantity } : {}),
  ...overrides,
});

const supplementSpecs = (
  quantity: string,
  overrides: Record<string, string> = {}
) => ({
  Form: 'Tablet',
  Dosage: '1 per day or as directed',
  Dietary: 'Supplement',
  Storage: 'Keep tightly closed in a dry place',
  Quantity: quantity,
  ...overrides,
});

const hygieneSpecs = (overrides: Record<string, string> = {}) => ({
  Type: 'Hygiene Product',
  Usage: 'Daily use',
  'Skin Type': 'All skin types',
  Packaging: 'Standard',
  ...overrides,
});

const firstAidSpecs = (
  type: string,
  overrides: Record<string, string> = {}
) => ({
  Type: type,
  Application: 'External use only',
  Sterile: 'N/A',
  Storage: 'Room temperature',
  ...overrides,
});

const sterileFirstAidSpecs = (
  type: string,
  overrides: Record<string, string> = {}
) => ({
  Type: type,
  Application: 'External use only',
  Sterile: 'Yes',
  Storage: 'Room temperature',
  ...overrides,
});

export const products: Product[] = [
  createProduct({
    id: '1',
    name: 'Paracetamol 500mg',
    description: 'For pain relief and fever reduction. 10 tablets.',
    price: 45,
    category: 'Medicines',
    image: MEDICINE_IMAGE,
    gallery: [
      'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&q=80&w=400&h=400',
    ],
    specifications: {
      'Active Ingredient': 'Paracetamol 500mg',
      Form: 'Tablet',
      Quantity: '10 tablets per pack',
      Indications: 'Fever, mild to moderate pain',
    },
  }),
  createProduct({
    id: '2',
    name: 'Isopropyl Alcohol 70%',
    description: 'Antiseptic disinfectant. 500ml.',
    price: 85,
    category: 'First Aid',
    image: FIRST_AID_IMAGE,
    gallery: [
      'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?auto=format&fit=crop&q=80&w=400&h=400',
    ],
    specifications: {
      'Active Ingredient': 'Isopropyl Alcohol 70%',
      Volume: '500ml',
      Usage: 'Topical antiseptic, disinfectant',
      Packaging: 'Plastic bottle',
    },
  }),
  createProduct({
    id: '3',
    name: 'Mint Toothpaste',
    description: 'Cavity protection and fresh breath. 150g.',
    price: 115,
    category: 'Personal Care',
    image: PERSONAL_CARE_IMAGE,
    specifications: {
      Flavor: 'Mint',
      Weight: '150g',
      Benefits: 'Cavity protection, fresh breath',
    },
  }),
  createProduct({
    id: '4',
    name: 'Vitamin C 1000mg',
    description: 'Immune system support. 30 capsules.',
    price: 250,
    category: 'Vitamins',
    image: VITAMIN_IMAGE,
    gallery: [MEDICINE_IMAGE],
    specifications: {
      'Active Ingredient': 'Ascorbic Acid 1000mg',
      Form: 'Capsule',
      Quantity: '30 capsules per bottle',
      Indications: 'Vitamin C deficiency, immune support',
    },
  }),
  createProduct({
    id: '5',
    name: 'Adhesive Bandages',
    description: 'Waterproof wound protection. Pack of 20.',
    price: 65,
    category: 'First Aid',
    image: FIRST_AID_ALT_IMAGE,
    specifications: sterileFirstAidSpecs('Adhesive Bandages'),
  }),
  createProduct({
    id: '6',
    name: 'Cough Syrup',
    description: 'Relieves dry and tickly coughs. 120ml.',
    price: 180,
    category: 'Medicines',
    image: MEDICINE_ALT_IMAGE,
    specifications: medicationSpecs(undefined, {
      Form: 'Liquid',
      Volume: '120ml',
    }),
  }),
  createProduct({
    id: '7',
    name: 'Antibacterial Soap',
    description: 'Kills 99.9% of germs. 3 bars.',
    price: 135,
    category: 'Personal Care',
    image: PERSONAL_CARE_ALT_IMAGE,
    specifications: hygieneSpecs(),
  }),
  createProduct({
    id: '8',
    name: 'Multivitamins for Adults',
    description: 'Daily essential vitamins and minerals. 60 tablets.',
    price: 450,
    category: 'Vitamins',
    image: VITAMIN_ALT_IMAGE,
    specifications: supplementSpecs('60 tablets'),
  }),
  createProduct({
    id: '9',
    name: 'Ibuprofen 400mg',
    description: 'Anti-inflammatory pain relief. 20 tablets.',
    price: 120,
    category: 'Medicines',
    image: MEDICINE_IMAGE,
    specifications: medicationSpecs('20 tablets'),
  }),
  createProduct({
    id: '10',
    name: 'Hydrogen Peroxide 3%',
    description: 'First aid antiseptic. 120ml.',
    price: 45,
    category: 'First Aid',
    image: FIRST_AID_IMAGE,
    specifications: firstAidSpecs('Hydrogen Peroxide 3%', { Volume: '120ml' }),
  }),
  createProduct({
    id: '11',
    name: 'Dental Floss',
    description: 'Mint flavored waxed floss. 50m.',
    price: 85,
    category: 'Personal Care',
    image: PERSONAL_CARE_IMAGE,
    specifications: hygieneSpecs(),
  }),
  createProduct({
    id: '12',
    name: 'Vitamin D3 1000 IU',
    description: 'Bone and immune support. 100 softgels.',
    price: 350,
    category: 'Vitamins',
    image: VITAMIN_IMAGE,
    specifications: supplementSpecs('100 softgels'),
  }),
  createProduct({
    id: '13',
    name: 'Gauze Pads',
    description: 'Sterile wound dressing. 10 pads.',
    price: 55,
    category: 'First Aid',
    image: FIRST_AID_ALT_IMAGE,
    specifications: sterileFirstAidSpecs('Gauze Pads'),
  }),
  createProduct({
    id: '14',
    name: 'Antacid Tablets',
    description: 'Fast relief from heartburn. 24 chewable tablets.',
    price: 150,
    category: 'Medicines',
    image: MEDICINE_ALT_IMAGE,
    specifications: medicationSpecs(),
  }),
  createProduct({
    id: '15',
    name: 'Hand Sanitizer',
    description: 'Kills 99.9% of germs. 250ml.',
    price: 95,
    category: 'Personal Care',
    image: PERSONAL_CARE_ALT_IMAGE,
    specifications: hygieneSpecs({ Volume: '250ml' }),
  }),
  createProduct({
    id: '16',
    name: 'Fish Oil Omega-3',
    description: 'Heart health support. 60 softgels.',
    price: 550,
    category: 'Vitamins',
    image: VITAMIN_ALT_IMAGE,
    specifications: supplementSpecs('60 softgels', { Form: 'Softgel' }),
  }),
  createProduct({
    id: '17',
    name: 'Loratadine 10mg',
    description: 'Non-drowsy allergy relief. 10 tablets.',
    price: 180,
    category: 'Medicines',
    image: MEDICINE_IMAGE,
    specifications: medicationSpecs('10 tablets'),
  }),
  createProduct({
    id: '18',
    name: 'Medical Tape',
    description: 'Breathable paper tape. 1 roll.',
    price: 35,
    category: 'First Aid',
    image: FIRST_AID_IMAGE,
    specifications: firstAidSpecs('Medical Tape'),
  }),
  createProduct({
    id: '19',
    name: 'Mouthwash',
    description: 'Antiseptic mouth rinse. 500ml.',
    price: 165,
    category: 'Personal Care',
    image: PERSONAL_CARE_IMAGE,
    specifications: hygieneSpecs({ Volume: '500ml' }),
  }),
  createProduct({
    id: '20',
    name: 'B-Complex Vitamins',
    description: 'Energy metabolism support. 50 tablets.',
    price: 280,
    category: 'Vitamins',
    image: VITAMIN_IMAGE,
    specifications: supplementSpecs('50 tablets'),
  }),
  createProduct({
    id: '21',
    name: 'Elastic Bandage',
    description: 'Compression wrap for sprains. 3 inch.',
    price: 85,
    category: 'First Aid',
    image: FIRST_AID_ALT_IMAGE,
    specifications: sterileFirstAidSpecs('Elastic Bandage'),
  }),
  createProduct({
    id: '22',
    name: 'Loperamide 2mg',
    description: 'Anti-diarrheal medication. 10 capsules.',
    price: 110,
    category: 'Medicines',
    image: MEDICINE_ALT_IMAGE,
    specifications: medicationSpecs('10 capsules'),
  }),
  createProduct({
    id: '23',
    name: 'Body Lotion',
    description: 'Intensive moisturizing lotion. 400ml.',
    price: 220,
    category: 'Personal Care',
    image: PERSONAL_CARE_ALT_IMAGE,
    specifications: hygieneSpecs({ Volume: '400ml' }),
  }),
  createProduct({
    id: '24',
    name: 'Zinc 50mg',
    description: 'Immune health support. 100 tablets.',
    price: 320,
    category: 'Vitamins',
    image: VITAMIN_ALT_IMAGE,
    specifications: supplementSpecs('100 tablets'),
  }),
  createProduct({
    id: '25',
    name: 'Aspirin 81mg',
    description: 'Low dose pain reliever. 30 tablets.',
    price: 95,
    category: 'Medicines',
    image: MEDICINE_IMAGE,
    specifications: medicationSpecs('30 tablets'),
  }),
  createProduct({
    id: '26',
    name: 'Thermometer',
    description: 'Digital oral thermometer.',
    price: 150,
    category: 'First Aid',
    image: FIRST_AID_IMAGE,
    specifications: firstAidSpecs('Thermometer'),
  }),
  createProduct({
    id: '27',
    name: 'Deodorant Roll-on',
    description: '48h antiperspirant protection. 50ml.',
    price: 105,
    category: 'Personal Care',
    image: PERSONAL_CARE_IMAGE,
    specifications: hygieneSpecs({ Volume: '50ml' }),
  }),
  createProduct({
    id: '28',
    name: 'Calcium + D3',
    description: 'Bone health supplement. 60 tablets.',
    price: 380,
    category: 'Vitamins',
    image: VITAMIN_IMAGE,
    specifications: supplementSpecs('60 tablets'),
  }),
  createProduct({
    id: '29',
    name: 'Antihistamine 5mg',
    description: 'Relief from allergy symptoms. 10 tablets.',
    price: 150,
    category: 'Medicines',
    image: MEDICINE_IMAGE,
    specifications: medicationSpecs('10 tablets'),
  }),
  createProduct({
    id: '30',
    name: 'Antiseptic Cream',
    description: 'For minor cuts and burns. 30g.',
    price: 210,
    category: 'First Aid',
    image: FIRST_AID_IMAGE,
    specifications: firstAidSpecs('Antiseptic Cream'),
  }),
  createProduct({
    id: '31',
    name: 'Face Wash',
    description: 'Gentle cleanser for all skin types. 150ml.',
    price: 280,
    category: 'Personal Care',
    image: PERSONAL_CARE_IMAGE,
    specifications: hygieneSpecs({ Volume: '150ml' }),
  }),
  createProduct({
    id: '32',
    name: 'Omega-3 Fish Oil 1000mg',
    description: 'Supports heart and brain health. 100 softgels.',
    price: 650,
    category: 'Vitamins',
    image: VITAMIN_IMAGE,
    specifications: supplementSpecs('100 softgels', { Form: 'Softgel' }),
  }),
  createProduct({
    id: '33',
    name: 'Naproxen Sodium 220mg',
    description: 'Long-lasting pain relief. 20 tablets.',
    price: 190,
    category: 'Medicines',
    image: MEDICINE_IMAGE,
    specifications: medicationSpecs('20 tablets'),
  }),
  createProduct({
    id: '34',
    name: 'Burn Gel',
    description: 'Cooling relief for minor burns. 50ml.',
    price: 175,
    category: 'First Aid',
    image: FIRST_AID_IMAGE,
    specifications: firstAidSpecs('Burn Gel', { Volume: '50ml' }),
  }),
  createProduct({
    id: '35',
    name: 'Shampoo with Conditioner',
    description: '2-in-1 formula for healthy hair. 400ml.',
    price: 245,
    category: 'Personal Care',
    image: PERSONAL_CARE_IMAGE,
    specifications: hygieneSpecs({ Volume: '400ml' }),
  }),
  createProduct({
    id: '36',
    name: 'Magnesium 250mg',
    description: 'Supports muscle and nerve function. 90 tablets.',
    price: 420,
    category: 'Vitamins',
    image: VITAMIN_IMAGE,
    specifications: supplementSpecs('90 tablets'),
  }),
  createProduct({
    id: '37',
    name: 'Antifungal Cream',
    description: 'Treats common fungal infections. 15g.',
    price: 230,
    category: 'Medicines',
    image: MEDICINE_IMAGE,
    specifications: medicationSpecs(undefined, { Form: 'Topical' }),
  }),
  createProduct({
    id: '38',
    name: 'Eye Wash Solution',
    description: 'Cleanses and soothes tired eyes. 100ml.',
    price: 140,
    category: 'First Aid',
    image: FIRST_AID_IMAGE,
    specifications: firstAidSpecs('Eye Wash Solution', { Volume: '100ml' }),
  }),
];

export const categories = ['All', 'Medicines', 'First Aid', 'Personal Care', 'Vitamins'];
