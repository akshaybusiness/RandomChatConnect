import { InsertUser, User, Report } from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createReport(report: Report): Promise<void>;
  getReports(): Promise<Report[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private reports: Report[];
  currentId: number;

  constructor() {
    this.users = new Map();
    this.reports = [];
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createReport(report: Report): Promise<void> {
    this.reports.push(report);
  }

  async getReports(): Promise<Report[]> {
    return this.reports;
  }
}

export const storage = new MemStorage();
