"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/query-client";

type AchSettingsSummary = {
  configured: boolean;
  beneficiaryName: string;
  bankName: string;
  accountType: string;
  referenceInstructions: string;
  routingNumberMasked: string;
  accountNumberLast4: string;
};

type AchSettingsForm = {
  beneficiaryName: string;
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: string;
  referenceInstructions: string;
};

type StripePaymentLinkSettings = {
  configured: boolean;
  paymentLinkUrl: string;
  source: "dashboard" | "environment" | "none" | "invalid";
};

const emptyForm: AchSettingsForm = {
  beneficiaryName: "",
  bankName: "",
  routingNumber: "",
  accountNumber: "",
  accountType: "checking",
  referenceInstructions: "",
};

export default function AchSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<AchSettingsForm>>({});
  const [stripeLinkForm, setStripeLinkForm] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [stripeNotice, setStripeNotice] = useState("");

  const { data, isLoading, isError } = useQuery<AchSettingsSummary>({
    queryKey: ["sponsors", "settings", "ach"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/sponsors/settings/ach");
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: AchSettingsForm) => {
      const response = await apiRequest("PUT", "/sponsors/settings/ach", values);
      return response.json();
    },
    onSuccess: async (result) => {
      setNotice(result.message || "ACH settings saved.");
      setForm({});
      await queryClient.invalidateQueries({ queryKey: ["sponsors", "settings", "ach"] });
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Unable to save ACH settings.");
    },
  });

  const { data: stripeLinkData, isLoading: stripeLinkLoading, isError: stripeLinkError } = useQuery<StripePaymentLinkSettings>({
    queryKey: ["sponsors", "settings", "stripe-payment-link"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/sponsors/settings/stripe-payment-link");
      return response.json();
    },
  });

  const saveStripeLinkMutation = useMutation({
    mutationFn: async (paymentLinkUrl: string) => {
      const response = await apiRequest("PUT", "/sponsors/settings/stripe-payment-link", { paymentLinkUrl });
      return response.json();
    },
    onSuccess: async (result) => {
      setStripeNotice(result.message || "Stripe Payment Link saved.");
      setStripeLinkForm(null);
      await queryClient.invalidateQueries({ queryKey: ["sponsors", "settings", "stripe-payment-link"] });
    },
    onError: (error) => {
      setStripeNotice(error instanceof Error ? error.message : "Unable to save Stripe Payment Link.");
    },
  });

  const updateField = (field: keyof AchSettingsForm, value: string) => {
    setNotice("");
    setForm((current) => ({ ...current, [field]: value }));
  };
  const stripePaymentLinkUrl = stripeLinkForm ?? stripeLinkData?.paymentLinkUrl ?? "";
  const isValidStripePaymentLink = (value: string) => {
    try {
      const url = new URL(value.trim());
      return url.protocol === "https:" && ["buy.stripe.com", "donate.stripe.com"].includes(url.hostname.toLowerCase()) && url.pathname.length > 1 && !url.username && !url.password && !url.hash;
    } catch {
      return false;
    }
  };
  const formValues: AchSettingsForm = {
    ...emptyForm,
    beneficiaryName: form.beneficiaryName ?? data?.beneficiaryName ?? "",
    bankName: form.bankName ?? data?.bankName ?? "",
    accountType: form.accountType ?? data?.accountType ?? "checking",
    referenceInstructions: form.referenceInstructions ?? data?.referenceInstructions ?? "",
    routingNumber: form.routingNumber ?? "",
    accountNumber: form.accountNumber ?? "",
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-sm uppercase text-muted-foreground">Dashboard / Settings</p>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">Payment settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          These organization bank details are encrypted in storage and emailed to sponsors only after they submit a manual transfer pledge.
        </p>
      </header>

      <Card className="border-border bg-card p-5 sm:p-7">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading settings
          </div>
        ) : isError ? (
          <p role="alert" className="text-sm text-destructive">Unable to load ACH settings. Check administrator access and try again.</p>
        ) : (
          <>
            <div className="mb-6 flex items-start gap-3 border-b border-border pb-5">
              <ShieldCheck className="mt-0.5 size-5 text-emerald-700" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="font-semibold text-foreground">Bank transfer details</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data?.configured
                    ? `Configured. Account ending in ${data.accountNumberLast4}; routing ${data.routingNumberMasked.toLowerCase()}.`
                    : "No ACH details are configured yet."}
                </p>
              </div>
            </div>

            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                setNotice("");
                saveMutation.mutate(formValues);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ach-beneficiary">Beneficiary name</Label>
                  <Input id="ach-beneficiary" required maxLength={120} value={formValues.beneficiaryName} onChange={(event) => updateField("beneficiaryName", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ach-bank">Bank name</Label>
                  <Input id="ach-bank" required maxLength={120} value={formValues.bankName} onChange={(event) => updateField("bankName", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ach-routing">Routing number</Label>
                  <Input id="ach-routing" inputMode="numeric" autoComplete="off" placeholder={data?.configured ? data.routingNumberMasked : "9 digits"} value={formValues.routingNumber} onChange={(event) => updateField("routingNumber", event.target.value.replace(/\D/g, "").slice(0, 9))} />
                  <p className="text-xs text-muted-foreground">Leave blank to keep the saved number.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ach-account">Account number</Label>
                  <Input id="ach-account" inputMode="numeric" autoComplete="off" placeholder={data?.configured ? `Account ending in ${data.accountNumberLast4}` : "4 to 17 digits"} value={formValues.accountNumber} onChange={(event) => updateField("accountNumber", event.target.value.replace(/\D/g, "").slice(0, 17))} />
                  <p className="text-xs text-muted-foreground">Leave blank to keep the saved number.</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="ach-account-type">Account type</Label>
                  <select id="ach-account-type" value={formValues.accountType} onChange={(event) => updateField("accountType", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="ach-reference-instructions">Transfer steps and reference instructions</Label>
                  <Textarea id="ach-reference-instructions" required minLength={5} maxLength={2000} rows={5} value={formValues.referenceInstructions} onChange={(event) => updateField("referenceInstructions", event.target.value)} />
                  <p className="text-xs text-muted-foreground">Tell sponsors how to initiate the transfer and where to include their pledge reference.</p>
                </div>
              </div>

              {notice ? <p role="status" className="text-sm text-foreground">{notice}</p> : null}
              <div className="flex justify-end border-t border-border pt-5">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                  {saveMutation.isPending ? "Saving..." : "Save ACH settings"}
                </Button>
              </div>
            </form>
          </>
        )}
      </Card>

      <Card className="border-border bg-card p-5 sm:p-7">
        <div className="mb-6 flex items-start gap-3 border-b border-border pb-5">
          <ShieldCheck className="mt-0.5 size-5 text-emerald-700" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">Stripe Payment Link</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This hosted link is shared by child sponsorship and homepage donations. Stripe collects the final amount and payer details.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {stripeLinkData?.configured
                ? stripeLinkData.source === "environment"
                  ? "Configured from the backend environment. Saving a link here will replace that fallback."
                  : "Payment Link configured."
                : "No Stripe Payment Link is configured."}
            </p>
          </div>
        </div>

        {stripeLinkLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading Stripe settings
          </div>
        ) : stripeLinkError ? (
          <p role="alert" className="text-sm text-destructive">Unable to load Stripe settings. Check administrator access and try again.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setStripeNotice("");
              if (!isValidStripePaymentLink(stripePaymentLinkUrl)) {
                setStripeNotice("Enter an HTTPS link hosted by buy.stripe.com or donate.stripe.com.");
                return;
              }
              saveStripeLinkMutation.mutate(stripePaymentLinkUrl.trim());
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="stripe-payment-link">Hosted Payment Link URL</Label>
              <Input
                id="stripe-payment-link"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://buy.stripe.com/..."
                value={stripePaymentLinkUrl}
                onChange={(event) => {
                  setStripeNotice("");
                  setStripeLinkForm(event.target.value);
                }}
                aria-invalid={Boolean(stripePaymentLinkUrl) && !isValidStripePaymentLink(stripePaymentLinkUrl)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Use the client&apos;s public Payment Link configured for a donor-chosen one-time amount and payer name/email collection. Do not enter Stripe API or webhook keys here.
              </p>
            </div>
            {stripeNotice ? <p role="status" className="text-sm text-foreground">{stripeNotice}</p> : null}
            <div className="flex justify-end border-t border-border pt-5">
              <Button type="submit" disabled={saveStripeLinkMutation.isPending || !isValidStripePaymentLink(stripePaymentLinkUrl)}>
                {saveStripeLinkMutation.isPending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                {saveStripeLinkMutation.isPending ? "Saving..." : "Save Stripe Payment Link"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}