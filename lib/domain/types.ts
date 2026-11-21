import type {
  ErrorResponse,
  PlanRequest,
  PlanResponse,
  ReservationResponse,
  StateResponse,
  WarehouseEvent,
} from "./contracts";

export type Scenario = StateResponse["scenario"];
export type ScenarioId = Scenario["id"];
export type Warehouse = StateResponse["warehouses"][number];
export type Sku = StateResponse["skus"][number];

// The public state view computes free stock from the two stored quantities.
export type StockRow = Omit<StateResponse["stock"][number], "free">;

type StateOrder = StateResponse["orders"][number];
export type Order = Omit<StateOrder, "lines"> & { customer_ref: string | null };
export type OrderLine = StateOrder["lines"][number] & { order_id: Order["id"] };

export type Incident = PlanRequest["incident"] & {
  evidence_quote: string;
  source_message: string;
};

export type PlanLine = PlanResponse["joint"]["lines"][number];
export type PlanResult = Pick<PlanResponse, "affected" | "first_come" | "joint" | "solver">;

export type Reservation = ReservationResponse["receipt"] & { budget_thb: number };
export type ErrorCode = ErrorResponse["error"]["code"];

export interface Snapshot {
  resumptions?: Extract<WarehouseEvent, { type: "resumed" }>[];
  scenario: Scenario;
  warehouses: Warehouse[];
  skus: Sku[];
  stock: StockRow[];
  orders: Order[];
  order_lines: OrderLine[];
  reservations: Reservation[];
}
