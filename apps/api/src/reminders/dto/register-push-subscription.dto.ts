export class RegisterPushSubscriptionDto {
  endpoint!: string;
  expirationTime!: number | null;
  keys!: {
    p256dh: string;
    auth: string;
  };
  deviceLabel?: string;
  userAgent?: string;
}
