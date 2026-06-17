"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  addresses: string[];
  onChange: (addresses: string[]) => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function AddressInputs({
  addresses,
  onChange,
  onSubmit,
  loading,
}: Props) {
  const addAddress = () => {
    if (addresses.length < 3) {
      onChange([...addresses, ""]);
    }
  };

  const removeAddress = (index: number) => {
    if (addresses.length > 1) {
      onChange(addresses.filter((_, i) => i !== index));
    }
  };

  const updateAddress = (index: number, value: string) => {
    const updated = [...addresses];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Enter Property Addresses</CardTitle>
        <CardDescription>
          Enter up to 3 US property addresses to compare
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {addresses.map((addr, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder={`Address ${i + 1} (e.g. 123 Main St, Austin, TX)`}
              value={addr}
              onChange={(e) => updateAddress(i, e.target.value)}
              disabled={loading}
            />
            {addresses.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeAddress(i)}
                disabled={loading}
                aria-label={`Remove address ${i + 1}`}
              >
                ✕
              </Button>
            )}
          </div>
        ))}

        <div className="flex items-center gap-3">
          {addresses.length < 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={addAddress}
              disabled={loading}
            >
              + Add Address
            </Button>
          )}
          <Button
            onClick={onSubmit}
            disabled={loading || addresses.every((a) => !a.trim())}
            className="ml-auto"
          >
            {loading ? "Comparing..." : "Compare Properties"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}