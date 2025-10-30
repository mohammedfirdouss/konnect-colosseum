import React from 'react'
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Star, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useUser } from '@/contexts/UserContext';
import { PublicKey, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
const idl = require("../idl.json");
const PROGRAM_ID = new PublicKey(idl.address);

const CreateListingModal = () => {
  const { user } = useUser();
  const { connected, publicKey } = useWallet();
  const { getMarketplaceAddress, createListing, loading, marketplaceAddress } =
    useMarketplace();

  const [createListingOpen, setCreateListingOpen] = useState(false);
  const [listingType, setListingType] = useState<"good" | "service">("good");
  const [listingName, setListingName] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingCategory, setListingCategory] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingQuantity, setListingQuantity] = useState("1");

  const handleCreateListing = async () => {
    if (
      !listingName.trim() ||
      !listingDescription.trim() ||
      !listingCategory ||
      !listingPrice
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!marketplaceAddress) {
      toast.error("Marketplace not available");
      return;
    }

    const price = parseFloat(listingPrice);
    if (price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    const quantity = parseInt(listingQuantity) || 1;
    if (quantity <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    try {
      toast.loading("Creating listing...", { id: "create-listing" });

      console.log(
        "Creating listing with marketplace:",
        marketplaceAddress?.toString()
      );
      console.log("Connected wallet:", publicKey?.toString());

      // Get merchant address (marketplace address comes from hook)

      // Get merchant PDA
      const [merchantPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("merchant"),
          marketplaceAddress.toBuffer(),
          publicKey.toBuffer(),
        ],
        new PublicKey(idl.address) // Program ID from IDL
      );

      // new PublicKey("mbLjS3jLDX74Ptza9EiiG4qcPPE9aPS7EzifCLZc5hJ") // Program ID from IDL

      // Use Native SOL (Wrapped SOL token) as the mint address
      // The smart contract expects a valid SPL token mint account to be initialized
      // In production, you would either:
      // 1. Create a new SPL token for each listing
      // 2. Use an existing token that represents your goods/services
      const mintAddress = new PublicKey(
        "So11111111111111111111111111111111111111112"
      ); // Native SOL mint address

      const tx = await createListing(
        marketplaceAddress,
        merchantPDA,
        mintAddress,
        price,
        quantity,
        listingType === "service",
        listingName,
        "" // Empty image URL for now, can be updated later
      );

      // Handle success or already-processed
      if (tx === "already-processed") {
        toast.success("Listing was already created!", { id: "create-listing" });
      } else {
        toast.success(`${listingName} has been listed on the marketplace!`, {
          id: "create-listing",
        });
      }

      console.log("Listing created successfully:", tx);

      // Reset form
      setListingName("");
      setListingDescription("");
      setListingCategory("");
      setListingPrice("");
      setListingQuantity("1");
      setListingType("good");
      setCreateListingOpen(false);
    } catch (error: any) {
      console.error("Error creating listing:", error);
      toast.error(`Failed to create listing: ${error.message}`, {
        id: "create-listing",
      });
    }
  };

  return (
    <Dialog open={createListingOpen} onOpenChange={setCreateListingOpen}>
      <DialogTrigger asChild>
        <Button style={{ backgroundColor: "#9945FF", color: "#FFFFFF" }}>
          <Plus size={20} className="mr-2" />
          Create Listing
        </Button>
      </DialogTrigger>
      <DialogContent
        style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "#FFFFFF" }}>
            Create New Listing
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Type Selection */}
          <div>
            <Label style={{ color: "#B3B3B3" }}>Listing Type</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => setListingType("good")}
                className="p-3 rounded-lg transition-all"
                style={{
                  backgroundColor:
                    listingType === "good"
                      ? "rgba(153, 69, 255, 0.2)"
                      : "#121212",
                  borderWidth: "2px",
                  borderColor: listingType === "good" ? "#9945FF" : "#333333",
                }}
              >
                <Package
                  size={24}
                  className="mx-auto mb-2"
                  style={{ color: "#9945FF" }}
                />
                <p style={{ color: "#FFFFFF" }}>Good</p>
              </button>
              <button
                onClick={() => setListingType("service")}
                className="p-3 rounded-lg transition-all"
                style={{
                  backgroundColor:
                    listingType === "service"
                      ? "rgba(153, 69, 255, 0.2)"
                      : "#121212",
                  borderWidth: "2px",
                  borderColor:
                    listingType === "service" ? "#9945FF" : "#333333",
                }}
              >
                <Star
                  size={24}
                  className="mx-auto mb-2"
                  style={{ color: "#9945FF" }}
                />
                <p style={{ color: "#FFFFFF" }}>Service</p>
              </button>
            </div>
          </div>

          <div>
            <Label style={{ color: "#B3B3B3" }}>Name *</Label>
            <Input
              placeholder={
                listingType === "good"
                  ? "e.g., iPhone 13 Pro"
                  : "e.g., Logo Design Service"
              }
              value={listingName}
              onChange={(e) => setListingName(e.target.value)}
              style={{
                backgroundColor: "#121212",
                borderColor: "#333333",
                color: "#FFFFFF",
              }}
            />
          </div>

          <div>
            <Label style={{ color: "#B3B3B3" }}>Description *</Label>
            <Textarea
              placeholder="Describe your item or service..."
              value={listingDescription}
              onChange={(e) => setListingDescription(e.target.value)}
              rows={3}
              style={{
                backgroundColor: "#121212",
                borderColor: "#333333",
                color: "#FFFFFF",
              }}
            />
          </div>

          <div>
            <Label style={{ color: "#B3B3B3" }}>Category *</Label>
            <Select value={listingCategory} onValueChange={setListingCategory}>
              <SelectTrigger
                style={{
                  backgroundColor: "#121212",
                  borderColor: "#333333",
                  color: "#FFFFFF",
                }}
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent
                style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
              >
                <SelectItem value="electronics" style={{ color: "#FFFFFF" }}>
                  Electronics
                </SelectItem>
                <SelectItem value="fashion" style={{ color: "#FFFFFF" }}>
                  Fashion
                </SelectItem>
                <SelectItem value="books" style={{ color: "#FFFFFF" }}>
                  Books
                </SelectItem>
                <SelectItem value="beauty" style={{ color: "#FFFFFF" }}>
                  Beauty & Personal Care
                </SelectItem>
                <SelectItem value="home" style={{ color: "#FFFFFF" }}>
                  Home & Living
                </SelectItem>
                <SelectItem value="education" style={{ color: "#FFFFFF" }}>
                  Education
                </SelectItem>
                <SelectItem value="design" style={{ color: "#FFFFFF" }}>
                  Design
                </SelectItem>
                <SelectItem value="tech" style={{ color: "#FFFFFF" }}>
                  Tech
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label style={{ color: "#B3B3B3" }}>Price (NGN) *</Label>
            <Input
              type="number"
              placeholder="0"
              value={listingPrice}
              onChange={(e) => setListingPrice(e.target.value)}
              style={{
                backgroundColor: "#121212",
                borderColor: "#333333",
                color: "#FFFFFF",
              }}
            />
          </div>

          <div>
            <Label style={{ color: "#B3B3B3" }}>Quantity *</Label>
            <Input
              type="number"
              placeholder="1"
              value={listingQuantity}
              onChange={(e) => setListingQuantity(e.target.value)}
              style={{
                backgroundColor: "#121212",
                borderColor: "#333333",
                color: "#FFFFFF",
              }}
            />
          </div>

          <Button
            className="w-full"
            style={{ backgroundColor: "#9945FF", color: "#FFFFFF" }}
            onClick={handleCreateListing}
            disabled={loading}
          >
            {loading ? "Creating Listing..." : "Publish Listing"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateListingModal