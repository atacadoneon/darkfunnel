export type MeetingStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export type MeetingAttendee = {
  name?: string;
  email?: string;
  user_id?: string;
  status?: "pending" | "accepted" | "declined";
};

export type Meeting = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  meeting_url: string | null;
  contact_id: string | null;
  deal_id: string | null;
  attendees: MeetingAttendee[] | null;
  organizer_id: string | null;
  status: MeetingStatus;
  created_at: string;
  updated_at: string;
};

export type MeetingInput = Partial<Omit<Meeting, "id" | "workspace_id" | "created_at" | "updated_at">>;
