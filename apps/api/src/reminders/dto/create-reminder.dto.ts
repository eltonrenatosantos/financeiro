export class CreateReminderDto {
  relatedEntityType!: string;
  relatedEntityId!: string | null;
  schedule!: string;
  channel?: "push";
  payload?: {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
  };
}
