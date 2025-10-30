import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Truck, CheckCircle, Eye, Calendar, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUser } from "@/contexts/UserContext";
import { useCart } from "@/contexts/CartContext";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useIsMobile";
import { PendingOrder } from "@/interfaces";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
const idl = require("../../idl.json");

const SellerCart = () => {
  const { user, setUser } = useUser();
  const { clearCart, getCartTotal } = useCart();
  const { isMobile } = useIsMobile();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const {
    releaseServiceOrder,
    getMarketplaceAddress,
    allListings,
    loading: marketplaceLoading,
    marketplaceAddress,
    getSellerPendingOrders,
    getSellerOngoingOrders,
    getSellerCompletedOrders,
  } = useMarketplace();

  const [activeTab, setActiveTab] = useState("pending");
  const [deliveryCodeDialog, setDeliveryCodeDialog] = useState(false);
  const [deliveryCode, setDeliveryCode] = useState("");

  const [orderDetailsDialog, setOrderDetailsDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);

  // State for blockchain orders
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [ongoingOrders, setOngoingOrders] = useState<any[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Fetch orders when component mounts or wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      fetchOrders();
    }
  }, [connected, publicKey]);

  const fetchOrders = async () => {
    try {
      setOrdersLoading(true);

      // Fetch pending orders (unreleased escrows awaiting acceptance)
      const pending = await getSellerPendingOrders();
      setPendingOrders(pending);

      // Fetch ongoing orders (unreleased escrows in progress)
      const ongoing = await getSellerOngoingOrders();
      setOngoingOrders(ongoing);

      // Fetch completed orders (released escrows)
      const completed = await getSellerCompletedOrders();
      setCompletedOrders(completed);

      console.log("Seller orders fetched:", { pending, ongoing, completed });
    } catch (error) {
      console.error("Error fetching seller orders:", error);
      // Don't show error toast, just log it
    } finally {
      setOrdersLoading(false);
    }
  };

  const calculateFees = (subtotal: number) => {
    return Math.round(subtotal * 0.02); // 2% platform fee
  };

  const handleFinalizeOrder = () => {
    // In a real app, this would process the payment and create the order
    toast.success("Order placed successfully! Funds are in escrow.", {
      duration: 3000,
    });

    // Update gamification points
    if (user) {
      const pointsEarned = 10; // Points for placing order
      setUser({
        ...user,
        gamificationPoints: (user.gamificationPoints || 0) + pointsEarned,
      });

      setTimeout(() => {
        toast.success(`+${pointsEarned} points earned!`, {
          duration: 2000,
        });
      }, 1000);
    }

    clearCart();
  };

  const handleViewOrderDetails = (order: PendingOrder) => {
    setSelectedOrder(order);
    setOrderDetailsDialog(true);
  };

  const handleCompleteServiceOrder = async (order: any) => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet to complete the service order");
      return;
    }

    try {
      toast.loading("Completing service order...", {
        id: "complete-service",
      });

      // Get escrow and listing addresses from the order
      const escrowPubkey = new PublicKey(order.escrowAddress);
      const listingPubkey = new PublicKey(order.listing);
      const mintAddress = new PublicKey(order.mint);

      // Derive vault - it's an ATA owned by the escrow PDA
      const vault = getAssociatedTokenAddressSync(
        mintAddress,
        escrowPubkey,
        true // allowOwnerOffCurve - escrow is a PDA
      );

      // Get proper Associated Token Accounts
      const sellerAta = getAssociatedTokenAddressSync(
        mintAddress,
        publicKey,
        false
      );

      // For treasury, get the marketplace authority's ATA
      let treasuryAta;
      try {
        const marketplaceAccount = await connection.getAccountInfo(
          marketplaceAddress
        );
        if (marketplaceAccount) {
          const authorityBytes = marketplaceAccount.data.slice(8, 40);
          const authority = new PublicKey(authorityBytes);
          treasuryAta = getAssociatedTokenAddressSync(
            mintAddress,
            authority,
            false
          );
        } else {
          throw new Error("Marketplace account not found");
        }
      } catch (error) {
        console.log(
          "Failed to get marketplace authority, using marketplace PDA:",
          error
        );
        treasuryAta = getAssociatedTokenAddressSync(
          mintAddress,
          marketplaceAddress,
          false
        );
      }

      await releaseServiceOrder(
        escrowPubkey,
        marketplaceAddress,
        listingPubkey,
        sellerAta,
        treasuryAta,
        vault
      );

      toast.success("Service order completed! Funds released.", {
        id: "complete-service",
      });

      // Update gamification points
      if (user) {
        const pointsEarned = 20; // Points for completing service
        setUser({
          ...user,
          gamificationPoints: (user.gamificationPoints || 0) + pointsEarned,
        });

        setTimeout(() => {
          toast.success(`+${pointsEarned} points earned!`, {
            duration: 2000,
          });
        }, 1000);
      }

      // Refresh orders after successful completion
      await fetchOrders();
    } catch (error: any) {
      console.error("Failed to complete service order:", error);
      toast.error(`Failed to complete service order: ${error.message}`, {
        id: "complete-service",
      });
    }
  };

  const handleAcceptOrder = (orderId: number) => {
    toast.success("Order accepted! Moving to ongoing orders...", {
      duration: 2000,
    });

    // Update gamification points
    if (user) {
      const pointsEarned = 15; // Points for accepting order
      setUser({
        ...user,
        gamificationPoints: (user.gamificationPoints || 0) + pointsEarned,
      });

      setTimeout(() => {
        toast.success(`+${pointsEarned} points earned!`, {
          duration: 2000,
        });
      }, 1000);
    }

    setOrderDetailsDialog(false);
    setActiveTab("ongoing");
  };

  const handleConfirmDelivery = () => {
    if (deliveryCode.trim().length < 4) {
      toast.error("Please enter a valid delivery code");
      return;
    }

    toast.success("Delivery confirmed! Escrow funds released.", {
      duration: 3000,
    });

    // Update gamification points
    if (user) {
      const pointsEarned = 25; // Points for completing delivery
      setUser({
        ...user,
        gamificationPoints: (user.gamificationPoints || 0) + pointsEarned,
      });

      setTimeout(() => {
        toast.success(`+${pointsEarned} points earned!`, {
          duration: 2000,
        });
      }, 1500);
    }

    setDeliveryCodeDialog(false);
    setDeliveryCode("");
    setActiveTab("completed");
  };

  const subtotal = getCartTotal();
  const fees = calculateFees(subtotal);
  const total = subtotal + fees;

  return (
    <div
      className={
        isMobile
          ? "px-4 py-6 space-y-6"
          : "max-w-7xl mx-auto px-8 py-8 space-y-6"
      }
    >
      <h2 style={{ color: "#FFFFFF" }}>My Orders</h2>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          className={isMobile ? "w-full grid grid-cols-3" : "inline-flex"}
          style={{ backgroundColor: "#1E1E1E" }}
        >
          <TabsTrigger
            value="pending"
            style={{
              color: activeTab === "pending" ? "#FFFFFF" : "#B3B3B3",
              backgroundColor:
                activeTab === "pending" ? "#9945FF" : "transparent",
            }}
          >
            Pending ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger
            value="ongoing"
            style={{
              color: activeTab === "ongoing" ? "#FFFFFF" : "#B3B3B3",
              backgroundColor:
                activeTab === "ongoing" ? "#9945FF" : "transparent",
            }}
          >
            Ongoing ({ongoingOrders.length})
          </TabsTrigger>
          <TabsTrigger
            value="completed"
            style={{
              color: activeTab === "completed" ? "#FFFFFF" : "#B3B3B3",
              backgroundColor:
                activeTab === "completed" ? "#9945FF" : "transparent",
            }}
          >
            Completed
          </TabsTrigger>
        </TabsList>

        {/* Pending Orders */}
        <TabsContent
          value="pending"
          className={
            isMobile
              ? "space-y-3 mt-4"
              : "grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6"
          }
        >
          {ordersLoading ? (
            <Card
              className="p-8 text-center col-span-full"
              style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
            >
              <p style={{ color: "#B3B3B3" }}>Loading orders...</p>
            </Card>
          ) : pendingOrders.length === 0 ? (
            <Card
              className="p-8 text-center col-span-full"
              style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
            >
              <Package
                size={48}
                className="mx-auto mb-4"
                style={{ color: "#666666" }}
              />
              <p style={{ color: "#B3B3B3" }}>No pending orders</p>
            </Card>
          ) : (
            pendingOrders.map((order) => (
              <Card
                key={order.escrowAddress}
                className="p-4"
                style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
              >
                <div className="flex gap-3">
                  <div
                    className="w-20 h-20 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "#333333" }}
                  >
                    <Package size={32} style={{ color: "#9945FF" }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1" style={{ color: "#FFFFFF" }}>
                      {order.listingDetails?.name || "Unknown Item"}
                    </h3>
                    <p className="text-sm" style={{ color: "#B3B3B3" }}>
                      Buyer: {order.buyer.slice(0, 4)}...{order.buyer.slice(-4)}
                    </p>
                    <div
                      className="mt-2 px-2 py-1 rounded inline-block text-xs"
                      style={{ backgroundColor: "#FFBF00", color: "#121212" }}
                    >
                      Pending
                    </div>
                    <p className="mt-2" style={{ color: "#9945FF" }}>
                      {(order.amount / 1e9).toFixed(4)} SOL
                    </p>
                    <p className="text-xs mt-2" style={{ color: "#666666" }}>
                      Funds locked in escrow
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Ongoing Orders */}
        <TabsContent
          value="ongoing"
          className={
            isMobile
              ? "space-y-3 mt-4"
              : "grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6"
          }
        >
          {ordersLoading ? (
            <Card
              className="p-8 text-center col-span-full"
              style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
            >
              <p style={{ color: "#B3B3B3" }}>Loading orders...</p>
            </Card>
          ) : ongoingOrders.length === 0 ? (
            <Card
              className="p-8 text-center col-span-full"
              style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
            >
              <Truck
                size={48}
                className="mx-auto mb-4"
                style={{ color: "#666666" }}
              />
              <p style={{ color: "#B3B3B3" }}>No ongoing orders</p>
            </Card>
          ) : (
            ongoingOrders.map((order) => (
              <Card
                key={order.escrowAddress}
                className="p-4"
                style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
              >
                <div className="flex gap-3">
                  <div
                    className="w-20 h-20 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "#333333" }}
                  >
                    <Truck size={32} style={{ color: "#9945FF" }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1" style={{ color: "#FFFFFF" }}>
                      {order.listingDetails?.name || "Unknown Item"}
                    </h3>
                    <p className="text-sm" style={{ color: "#B3B3B3" }}>
                      Buyer: {order.buyer.slice(0, 4)}...{order.buyer.slice(-4)}
                    </p>
                    <div
                      className="mt-2 px-2 py-1 rounded inline-block text-xs"
                      style={{ backgroundColor: "#FFBF00", color: "#121212" }}
                    >
                      In Escrow
                    </div>
                    <p className="mt-2" style={{ color: "#9945FF" }}>
                      {(order.amount / 1e9).toFixed(4)} SOL
                    </p>
                    <div
                      className="mt-3 p-3 rounded-lg"
                      style={{ backgroundColor: "#121212" }}
                    >
                      <p className="text-xs" style={{ color: "#B3B3B3" }}>
                        Reference:
                      </p>
                      <p
                        className="text-xs font-mono"
                        style={{ color: "#9945FF" }}
                      >
                        {order.reference.slice(0, 8)}...
                        {order.reference.slice(-8)}
                      </p>
                      <p className="text-xs mt-2" style={{ color: "#666666" }}>
                        {order.listingDetails?.isService
                          ? "Complete service to release funds"
                          : "Confirm delivery to release funds"}
                      </p>
                    </div>

                    {order.listingDetails?.isService ? (
                      <Button
                        className="w-full mt-3"
                        size="sm"
                        onClick={() => handleCompleteServiceOrder(order)}
                        style={{ backgroundColor: "#4AFF99", color: "#121212" }}
                        disabled={!connected || marketplaceLoading}
                      >
                        {marketplaceLoading
                          ? "Processing..."
                          : "Complete Service & Release Funds"}
                      </Button>
                    ) : (
                      <Button
                        className="w-full mt-3"
                        size="sm"
                        onClick={() => handleCompleteServiceOrder(order)}
                        style={{ backgroundColor: "#9945FF", color: "#FFFFFF" }}
                        disabled={!connected || marketplaceLoading}
                      >
                        {marketplaceLoading ? "Processing..." : "Release Funds"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Completed Orders */}
        <TabsContent
          value="completed"
          className={
            isMobile
              ? "space-y-3 mt-4"
              : "grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6"
          }
        >
          {ordersLoading ? (
            <Card
              className="p-8 text-center col-span-full"
              style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
            >
              <p style={{ color: "#B3B3B3" }}>Loading orders...</p>
            </Card>
          ) : completedOrders.length === 0 ? (
            <Card
              className="p-8 text-center col-span-full"
              style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
            >
              <CheckCircle
                size={48}
                className="mx-auto mb-4"
                style={{ color: "#666666" }}
              />
              <p style={{ color: "#B3B3B3" }}>No completed orders</p>
            </Card>
          ) : (
            completedOrders.map((order) => (
              <Card
                key={order.escrowAddress}
                className="p-4"
                style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
              >
                <div className="flex gap-3">
                  <div
                    className="w-20 h-20 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "#4AFF99" }}
                  >
                    <CheckCircle size={32} style={{ color: "#121212" }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1" style={{ color: "#FFFFFF" }}>
                      {order.listingDetails?.name || "Unknown Item"}
                    </h3>
                    <p className="text-sm" style={{ color: "#B3B3B3" }}>
                      Buyer: {order.buyer.slice(0, 4)}...{order.buyer.slice(-4)}
                    </p>
                    <div
                      className="mt-2 px-2 py-1 rounded inline-block text-xs"
                      style={{ backgroundColor: "#4AFF99", color: "#121212" }}
                    >
                      Completed
                    </div>
                    <div className="mt-2">
                      <p className="text-xs" style={{ color: "#666666" }}>
                        Revenue:
                      </p>
                      <p style={{ color: "#4AFF99" }}>
                        {(order.amount / 1e9).toFixed(4)} SOL
                      </p>
                    </div>
                    <p className="text-xs mt-2" style={{ color: "#666666" }}>
                      Funds released to seller
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Order Details Dialog */}
      <Dialog open={orderDetailsDialog} onOpenChange={setOrderDetailsDialog}>
        <DialogContent
          style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "#FFFFFF" }}>
              Order Details
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div
                  className="w-24 h-24 rounded-lg"
                  style={{ backgroundColor: "#333333" }}
                >
                  {selectedOrder.image ? (
                    <ImageWithFallback
                      src={selectedOrder.image}
                      alt={selectedOrder.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Package
                      size={48}
                      className="mx-auto mt-4"
                      style={{ color: "#666666" }}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <h3 style={{ color: "#FFFFFF" }}>{selectedOrder.name}</h3>
                  <p className="mt-2 text-xl" style={{ color: "#9945FF" }}>
                    ₦{selectedOrder.price.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: "#121212" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <User size={16} style={{ color: "#9945FF" }} />
                    <p className="text-sm" style={{ color: "#B3B3B3" }}>
                      Buyer Information
                    </p>
                  </div>
                  <p style={{ color: "#FFFFFF" }}>{selectedOrder.buyer}</p>
                  <p className="text-sm mt-1" style={{ color: "#B3B3B3" }}>
                    {selectedOrder.buyerPhone}
                  </p>
                </div>

                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: "#121212" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Package size={16} style={{ color: "#9945FF" }} />
                    <p className="text-sm" style={{ color: "#B3B3B3" }}>
                      Delivery Address
                    </p>
                  </div>
                  <p style={{ color: "#FFFFFF" }}>
                    {selectedOrder.deliveryAddress}
                  </p>
                </div>

                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: "#121212" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar size={16} style={{ color: "#9945FF" }} />
                    <p className="text-sm" style={{ color: "#B3B3B3" }}>
                      Order Date
                    </p>
                  </div>
                  <p style={{ color: "#FFFFFF" }}>{selectedOrder.orderDate}</p>
                </div>
              </div>

              <div
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: "rgba(153, 69, 255, 0.1)",
                  borderLeft: "3px solid #9945FF",
                }}
              >
                <p className="text-sm" style={{ color: "#B3B3B3" }}>
                  Funds are in escrow. Accept this order to begin delivery
                  process.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOrderDetailsDialog(false)}
                  style={{ borderColor: "#333333", color: "#B3B3B3" }}
                >
                  Close
                </Button>
                <Button
                  className="flex-1"
                  onClick={() =>
                    selectedOrder && handleAcceptOrder(selectedOrder.id)
                  }
                  style={{ backgroundColor: "#9945FF", color: "#FFFFFF" }}
                >
                  Accept Order
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delivery Code Dialog for Sellers */}
      <Dialog open={deliveryCodeDialog} onOpenChange={setDeliveryCodeDialog}>
        <DialogContent
          style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "#FFFFFF" }}>
              Confirm Delivery
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p style={{ color: "#B3B3B3" }}>
              Enter the buyer's delivery code to release escrow funds
            </p>
            <div>
              <Label style={{ color: "#B3B3B3" }}>Delivery Code</Label>
              <Input
                value={deliveryCode}
                onChange={(e) => setDeliveryCode(e.target.value)}
                placeholder="Enter 4-digit code"
                maxLength={4}
                style={{
                  backgroundColor: "#121212",
                  borderColor: "#333333",
                  color: "#FFFFFF",
                }}
              />
            </div>
            <div
              className="p-3 rounded-lg"
              style={{
                backgroundColor: "rgba(74, 255, 153, 0.1)",
                borderLeft: "3px solid #4AFF99",
              }}
            >
              <p className="text-sm" style={{ color: "#B3B3B3" }}>
                ✅ After confirmation, funds will be released to your wallet and
                you'll earn gamification points!
              </p>
            </div>
            <Button
              className="w-full"
              style={{ backgroundColor: "#9945FF", color: "#FFFFFF" }}
              onClick={handleConfirmDelivery}
            >
              Confirm & Release Escrow
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellerCart;
