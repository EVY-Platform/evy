-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);
