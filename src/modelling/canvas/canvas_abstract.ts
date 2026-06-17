import { Transform } from "../../math/transform";
import { ControlState, Tool } from "../types";

export abstract class ACanvas {
    context: CanvasRenderingContext2D;
    width: number = 0;
    height: number = 0;

    control_state: ControlState = ControlState.Idle;
    active_tool: Tool = Tool.Select;
    world_to_canvas_tfm: Transform = new Transform();

    private canvas: HTMLCanvasElement;
    private zone: HTMLDivElement;

    constructor(root_div: HTMLDivElement, canvas_id: string, zone_id: string) {
        this.zone = document.getElementById(zone_id) as HTMLDivElement;

        this.canvas = root_div.querySelector("#" + canvas_id) as HTMLCanvasElement;
        this.context = this.canvas.getContext("2d") as CanvasRenderingContext2D;

        this.on_resize();
    }

    on_resize() {
        const rect = this.zone.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    abstract update(): void;
    abstract draw(ctx: CanvasRenderingContext2D, tfm: Transform, ignore_selection: boolean): void;

    define_context(in_state: ControlState, in_tool: Tool, in_tfm: Transform) {
        this.control_state = in_state;
        this.active_tool = in_tool;
        this.world_to_canvas_tfm = in_tfm;
    }
}