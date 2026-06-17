import { Transform } from "../../math/transform";
import { Vector2D } from "../../math/vector";
import { DRAW_POINT_COLOR, DRAW_POINT_SIZE, SELECT_BORDER, SELECT_COLOR } from "../styles";
import { ControlState, Tool } from "../types";
import { ACanvas } from "./canvas_abstract";

export class SelectCanvas extends ACanvas {
    private start_select_canvas: Vector2D = new Vector2D();
    private current_mouse_position: Vector2D = new Vector2D();
    private potential_point_do_add: Vector2D | null = null;

    constructor(root_div: HTMLDivElement, canvas_id: string, zone_id: string) {
        super(root_div, canvas_id, zone_id);
    }

    define_select_context(in_current_mouse_position: Vector2D, in_potential_point_do_add: Vector2D | null) {
        this.current_mouse_position = in_current_mouse_position;
        this.potential_point_do_add = in_potential_point_do_add;
    }
    
    define_start_select(in_start_select_canvas: Vector2D) {
        this.start_select_canvas = in_start_select_canvas;
    }

    draw(ctx: CanvasRenderingContext2D, tfm: Transform): void {
        if (this.control_state == ControlState.Select) {
            ctx.fillStyle = SELECT_COLOR;

            const x = this.start_select_canvas.get_x();
            const y = this.start_select_canvas.get_y();
            const w = this.current_mouse_position.get_x() - x;
            const h = this.current_mouse_position.get_y() - y;
            ctx.fillRect(x, y, w, h);

            ctx.strokeStyle = SELECT_BORDER;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, w, h);
        }
        if (this.active_tool == Tool.WallDraw || this.active_tool == Tool.PointDraw || this.active_tool == Tool.ZoneDraw || this.active_tool == Tool.ConnectionDraw || this.active_tool == Tool.DoorDraw) {
            if (this.potential_point_do_add) {
                // draw position for potential point which will be add to the room path if we click the mouse
                // calculate canvas center
                const center = tfm.apply(this.potential_point_do_add);
                ctx.fillStyle = DRAW_POINT_COLOR;
                ctx.beginPath();
                ctx.arc(center.get_x(), center.get_y(), DRAW_POINT_SIZE, 0, 2 * Math.PI, false);
                ctx.fill();
            }
        }
    }

    update() {
        this.context.clearRect(0, 0, this.width, this.height);

        this.draw(this.context, this.world_to_canvas_tfm);
    }
}