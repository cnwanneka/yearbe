CREATE TABLE IF NOT EXISTS yearbe_bedsheet_orders (
    checkout_id UUID PRIMARY KEY,
    cart JSONB NOT NULL,
    delivery_details JSONB NOT NULL,
    amount_pence INTEGER NOT NULL
        CHECK (amount_pence > 0),
    stripe_payment_intent_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);