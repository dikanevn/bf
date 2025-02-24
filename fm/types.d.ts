declare module '*.json' {
    const value: any;
    export default value;
}

export interface RoundData {
  d2: PlayerData[];
  d3: WinnerData[];
}

export interface PlayerData {
  number: number;
  player: string;
}

export interface WinnerData {
  number: number;
  player: string;
  randomValue: string;
}

export interface D02Item {
  round: number;
  value: string;
  TOTAL_TICKETS: string;
  coefficient: string;
  RewardsOrDeploy: string;
}
