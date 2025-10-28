export interface Product {
    id: number | string;
    name: string;
    price: number;
    seller?: string;
    rating: number;
    category: string;
    image: string;
    description?: string;
    location?: string;
    deliveryFee?: number;
    condition?: string;
    sellerRating?: number;
  }
  
  export interface Listing {
    id: number;
    name: string;
    description: string;
    price: number;
    category: string;
    type: 'good' | 'service';
    deliveryFee?: number;
    status: 'active' | 'sold' | 'inactive';
    views: number;
    sales: number;
  }

  export interface PendingOrder {
        id: number;
        name: string;
        price: number;
        buyer: string;
        buyerPhone?: string;
        deliveryAddress?: string;
        orderDate?: string;
        image?: string;
        seller?: string;
        status?: string;
        deliveryCode?: string;
        acceptedDate?: string;
        type?: 'good' | 'service';
  }