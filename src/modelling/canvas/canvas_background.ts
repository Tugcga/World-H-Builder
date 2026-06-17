import { Transform } from "../../math/transform";
import { Vector2D } from "../../math/vector";
import { BG_COLOR, BG_HARD_LINE, BG_LIGHT_LINE } from "../styles";
import { ACanvas } from "./canvas_abstract";

export class BackgroundCanvas extends ACanvas {
    constructor(root_div: HTMLDivElement, canvas_id: string, zone_id: string) {
        super(root_div, canvas_id, zone_id);
    }

    draw(ctx: CanvasRenderingContext2D, tfm: Transform) {
        // draw background
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, this.width, this.height);

        // next we should draw vertical and horizontal lines
        // we draw hard line on positions x5, on other integer positions - light lines
        // so, define the left and right limits in the world
        const canvas_to_world = tfm.get_inverse();
        const left_top_pos = canvas_to_world.apply(new Vector2D(0, 0));
        const right_bottom_pos = canvas_to_world.apply(new Vector2D(this.width, this.height));
        ctx.strokeStyle = BG_LIGHT_LINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = Math.floor(left_top_pos.get_x()); x < Math.ceil(right_bottom_pos.get_x()); x++) {
            if (x % 5 == 0) {
                // skip hard lines
                continue;
            }
            const pos_x = tfm.apply_coordinates(x, 0).get_x();
            ctx.moveTo(pos_x, 0);
            ctx.lineTo(pos_x, this.height);
        }
        // now horizontal lines
        for (let y = Math.floor(right_bottom_pos.get_y()); y < Math.ceil(left_top_pos.get_y()); y++) {
            if (y % 5 == 0) {
                continue;
            }

            const pos_y = tfm.apply_coordinates(0, y).get_y();
            ctx.moveTo(0, pos_y);
            ctx.lineTo(this.width, pos_y);
        }
        ctx.stroke();

        // now draw hard lines
        ctx.strokeStyle = BG_HARD_LINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = Math.round(left_top_pos.get_x() / 5) * 5; x < Math.round(right_bottom_pos.get_x() / 5) * 5 + 1; x+= 5) {
            const pos_x = tfm.apply_coordinates(x, 0).get_x();
            ctx.moveTo(pos_x, 0);
            ctx.lineTo(pos_x, this.height);
        }
        // the same for the y
        for (let y = Math.round(right_bottom_pos.get_y() / 5) * 5; y <  Math.round(left_top_pos.get_y() / 5) * 5 + 1; y+= 5) {
            const pos_y = tfm.apply_coordinates(0, y).get_y();
            ctx.moveTo(0, pos_y);
            ctx.lineTo(this.width, pos_y);
        }
        ctx.stroke();
    }

    update() {
        // clear canvas
        this.context.clearRect(0, 0, this.width, this.height);

        this.draw(this.context, this.world_to_canvas_tfm);
    }
}