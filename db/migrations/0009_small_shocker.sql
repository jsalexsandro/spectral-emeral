CREATE TABLE "DeviceAuditEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"deviceId" text NOT NULL,
	"userId" text NOT NULL,
	"chatId" text,
	"toolName" text NOT NULL,
	"command" text,
	"risk" text NOT NULL,
	"decision" text NOT NULL,
	"policy" text NOT NULL,
	"mode" text NOT NULL,
	"durationMs" integer,
	"exitCode" integer,
	"errorCode" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Device" ADD COLUMN "executionPolicy" jsonb;--> statement-breakpoint
ALTER TABLE "Device" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "DeviceAuditEvent" ADD CONSTRAINT "DeviceAuditEvent_deviceId_Device_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DeviceAuditEvent" ADD CONSTRAINT "DeviceAuditEvent_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "DeviceAuditEvent_deviceId_createdAt_idx" ON "DeviceAuditEvent" USING btree ("deviceId","createdAt");--> statement-breakpoint
CREATE INDEX "DeviceAuditEvent_userId_createdAt_idx" ON "DeviceAuditEvent" USING btree ("userId","createdAt");