-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL,
    "token" VARCHAR(256) NOT NULL,
    "os" VARCHAR(7) NOT NULL,
    "created_at" DATE NOT NULL,
    "updated_at" DATE NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_token_idx" ON "Device"("token");

