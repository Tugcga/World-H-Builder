import { Vector2D } from "./vector";

function position_to_matrix(position: Vector2D): Float32Array {
    let to_return = new Float32Array(9);
    to_return[0] = 1; to_return[1] = 0; to_return[2] = position.get_x();
    to_return[3] = 0; to_return[4] = 1; to_return[5] = position.get_y();
    to_return[6] = 0; to_return[7] = 0; to_return[8] = 1;

    return to_return;
}

function rotation_to_matrix(rotation: number): Float32Array {
    let to_return = new Float32Array(9);
    to_return[0] = Math.cos(rotation); to_return[1] = -Math.sin(rotation); to_return[2] = 0;
    to_return[3] = Math.sin(rotation); to_return[4] = Math.cos(rotation); to_return[5] = 0;
    to_return[6] = 0; to_return[7] = 0; to_return[8] = 1;

    return to_return;
}

function scale_to_matrix(scale: Vector2D): Float32Array {
    let to_return = new Float32Array(9);
    to_return[0] = scale.get_x(); to_return[1] = 0; to_return[2] = 0;
    to_return[3] = 0; to_return[4] = scale.get_y(); to_return[5] = 0;
    to_return[6] = 0; to_return[7] = 0; to_return[8] = 1;

    return to_return;
}

function mult_matrices(a: Float32Array, b: Float32Array): Float32Array {
    let to_return = new Float32Array(9);
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            let s = 0.0;
            for (let k = 0; k < 3; k++) {
                s += a[3 * i + k] * b[j + 3 * k];
            }
            to_return[3 * i + j] = s;
        }
    }

    return to_return;
}

export class Transform {
    // init by default values
    private position: Vector2D = new Vector2D();
    private scale: Vector2D = new Vector2D(1.0, 1.0);
    private rotation: number = 0.0;

    private matrix: Float32Array = new Float32Array(9);

    private dirty_inverse: boolean = true;  // disable when calculate inverse and store it
    // when tfm updated, activate this flag, it mead tha inverse should be calculate again
    private inverse_tfm: Transform | null = null;

    constructor(in_position: Vector2D = new Vector2D(0.0, 0.0), in_rotation: number = 0.0, in_scale: Vector2D = new Vector2D(1.0, 1.0)) {
        this.position = in_position;
        this.rotation = in_rotation;
        this.scale = in_scale;

        this.update_matrix();
    }

    private update_matrix() {
        const t_matrix = position_to_matrix(this.position);
        const r_matrix = rotation_to_matrix(this.rotation);
        const s_matrix = scale_to_matrix(this.scale);

        this.matrix = mult_matrices(mult_matrices(t_matrix, r_matrix), s_matrix);

        this.dirty_inverse = true;
    }

    apply(in_point: Vector2D): Vector2D {
        return new Vector2D(this.matrix[0] * in_point.get_x() + this.matrix[1] * in_point.get_y() + this.matrix[2],
                            this.matrix[3] * in_point.get_x() + this.matrix[4] * in_point.get_y() + this.matrix[5]);
    }

    apply_coordinates(in_x: number, in_y: number): Vector2D {
        return this.apply(new Vector2D(in_x, in_y));
    }

    set_position(in_position: Vector2D) {
        this.position = in_position;
        this.update_matrix();
    }

    set_position_coords(in_x: number, in_y: number) {
        this.set_position(new Vector2D(in_x, in_y));
    }

    set_rotation(in_rotation: number) {
        this.rotation = in_rotation;
        this.update_matrix();
    }

    set_scale(in_scale: Vector2D) {
        this.scale = in_scale;
        this.update_matrix();
    }

    set_scale_values(in_x: number, in_y: number) {
        this.set_scale(new Vector2D(in_x, in_y));
    }

    set_scale_uniform(in_scale: number) {
        this.set_scale(new Vector2D(in_scale, in_scale))
    }

    get_position(): Vector2D {
        return this.position;
    }

    get_scale(): Vector2D {
        return this.scale;
    }

    get_inverse(): Transform {
        if (this.dirty_inverse || this.inverse_tfm == null) {
            this.inverse_tfm = new Transform();
        
            this.inverse_tfm.set_position_coords(-this.position.get_x() / this.scale.get_x(), -this.position.get_y() / this.scale.get_y());
            this.inverse_tfm.set_rotation(-this.rotation);
            this.inverse_tfm.set_scale_values(1.0 / this.scale.get_x(), 1.0 / this.scale.get_y());

            this.dirty_inverse = false;
        }

        return this.inverse_tfm;
    }
}