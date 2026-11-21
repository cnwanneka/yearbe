
BEGIN;

CREATE TABLE IF NOT EXISTS yearbe_cj_checkout_sessions (

    checkout_id UUID PRIMARY KEY,

    access_token_hash TEXT NOT NULL
        CHECK (
            access_token_hash ~ '^[0-9a-f]{64}$'
        ),

    checkout_request JSONB NOT NULL,

    validation_snapshot JSONB NOT NULL,

    amount_pence INTEGER NOT NULL
        CHECK (amount_pence > 0),

    currency TEXT NOT NULL DEFAULT 'GBP'
        CHECK (currency = 'GBP'),

    status TEXT NOT NULL DEFAULT 'preview_validated'
        CHECK (
            status IN (
                'preview_validated',
                'revalidation_required'
            )
        ),

    revision INTEGER NOT NULL DEFAULT 1
        CHECK (revision >= 1),

    preview_only BOOLEAN NOT NULL DEFAULT TRUE
        CHECK (preview_only = TRUE),

    payment_allowed BOOLEAN NOT NULL DEFAULT FALSE
        CHECK (payment_allowed = FALSE),

    validation_started_at TIMESTAMPTZ NOT NULL,

    validated_at TIMESTAMPTZ NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (expires_at > validation_started_at),

    CHECK (
        jsonb_typeof(checkout_request) = 'object'
    ),

    CHECK (
        jsonb_typeof(validation_snapshot) = 'object'
    )
);

CREATE INDEX IF NOT EXISTS
    idx_yearbe_cj_checkout_expiry

ON yearbe_cj_checkout_sessions (
    expires_at
);

CREATE INDEX IF NOT EXISTS
    idx_yearbe_cj_checkout_status

ON yearbe_cj_checkout_sessions (
    status
);

COMMIT;
