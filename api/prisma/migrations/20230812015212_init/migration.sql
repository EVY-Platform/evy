-- CreateTable
CREATE TABLE "Device" (
    "token" VARCHAR(256) NOT NULL,
    "os" VARCHAR(7) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("token")
);
