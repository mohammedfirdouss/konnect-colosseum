"use client";
import { useUser } from '@/contexts/UserContext';
import SellerCart from '@/components/sellers/SellerCart';
import BuyerCart from '@/components/buyers/BuyerCart';


 const CartPage = () => {
  const { user } = useUser();

  const isSeller = user?.role === 'seller' || user?.role === 'both';

  // Seller View
  if (isSeller) return <SellerCart/>;

  return <BuyerCart/>
}


export default CartPage;