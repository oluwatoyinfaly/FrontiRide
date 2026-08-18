// Client Fedapay minimal — MVP.
// Docs API : https://docs.fedapay.com
// Le secret d'API et l'environnement (sandbox/live) viennent des variables d'env.

const FEDAPAY_API_URL =
  process.env.FEDAPAY_ENV === "live"
    ? "https://api.fedapay.com/v1"
    : "https://sandbox-api.fedapay.com/v1";

interface CreateTransactionInput {
  amountFcfa: number;
  description: string;
  customer: { email: string; phone: string };
  callbackUrl: string;
}

interface FedapayTransaction {
  id: string;
  status: string;
  paymentUrl: string;
}

export async function createFedapayTransaction(
  input: CreateTransactionInput
): Promise<FedapayTransaction> {
  const apiKey = process.env.FEDAPAY_SECRET_KEY;
  if (!apiKey) {
    throw new Error("FEDAPAY_SECRET_KEY manquant dans l'environnement");
  }

  const response = await fetch(`${FEDAPAY_API_URL}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      amount: input.amountFcfa,
      currency: { iso: "XOF" },
      description: input.description,
      customer: input.customer,
      callback_url: input.callbackUrl,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fedapay error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    v1_transaction: { id: string; status: string };
  };

  const tokenResponse = await fetch(
    `${FEDAPAY_API_URL}/transactions/${data.v1_transaction.id}/token`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const tokenData = (await tokenResponse.json()) as {
    token: { url: string };
  };

  return {
    id: data.v1_transaction.id,
    status: data.v1_transaction.status,
    paymentUrl: tokenData.token.url,
  };
}
