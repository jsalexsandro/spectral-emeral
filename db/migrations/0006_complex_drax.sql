CREATE TABLE "DevicePairingSession" (
	"id" text PRIMARY KEY NOT NULL,
	"codeHash" text NOT NULL,
	"publicKey" text NOT NULL,
	"fingerprint" text NOT NULL,
	"hostname" text,
	"platform" text NOT NULL,
	"architecture" text,
	"expiresAt" timestamp NOT NULL,
	"consumedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Device" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"hostname" text,
	"platform" text NOT NULL,
	"architecture" text,
	"publicKey" text NOT NULL,
	"fingerprint" text NOT NULL,
	"lastSeenAt" timestamp,
	"revokedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "DevicePairingSession_codeHash_key" ON "DevicePairingSession" USING btree ("codeHash");--> statement-breakpoint
CREATE INDEX "DevicePairingSession_expiresAt_idx" ON "DevicePairingSession" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "DevicePairingSession_fingerprint_idx" ON "DevicePairingSession" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "Device_userId_idx" ON "Device" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Device_fingerprint_idx" ON "Device" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "Device_userId_revokedAt_idx" ON "Device" USING btree ("userId","revokedAt");