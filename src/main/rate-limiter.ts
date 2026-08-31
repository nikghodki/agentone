import type { Database } from "./database";

export class RateLimiter {
  private dailyLimit: number;

  constructor(dailyLimit: number) {
    this.dailyLimit = dailyLimit;
  }

  canGenerate(db: Database, licenseStatus: string): boolean {
    if (licenseStatus === "pro") return true;
    return db.getDailyGenerationCount() < this.dailyLimit;
  }

  recordGeneration(db: Database): void {
    db.incrementDailyGenerationCount();
  }

  getRemainingGenerations(db: Database, licenseStatus: string): number | "unlimited" {
    if (licenseStatus === "pro") return "unlimited";
    const used = db.getDailyGenerationCount();
    return Math.max(0, this.dailyLimit - used);
  }
}
