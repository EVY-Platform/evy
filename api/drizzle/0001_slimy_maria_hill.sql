ALTER TABLE "transaction" ALTER COLUMN "signature" TYPE jsonb USING to_jsonb("signature"::text);
