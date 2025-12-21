export type OverallRow = {
  entry_id: number;
  
  sail_number: string | null;
  boat_name: string;
  class_name: string;
  skipper_name: string;
  total_points: number;
  net_points: number;
  discardedRaceNames: Set<string>;
  per_race: Record<string, number | string>;
  overall_rank: number;
  finals_fleet?: string | null;
};