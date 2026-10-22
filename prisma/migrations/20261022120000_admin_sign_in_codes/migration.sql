-- Administrative sign-in codes for /dr.
-- Additive: one new table, nothing existing is touched. Dashboard sign-in keeps its own row,
-- cooldown and guess budget, so e-mail verification or password-reset traffic for the same
-- address can never occupy them.
CREATE TABLE "AdminSignInCode" (
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSignInCode_pkey" PRIMARY KEY ("email")
);
