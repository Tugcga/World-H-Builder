import { ModellerApp } from "./modelling/modeller_app";

/* WARNING: when add additional application:
1. Add type to the AppType enum
2. Define HEADER_BUTTON_*_ID and WORKSPACE_*_ID
3. Find div and button and add it to the app_elements map
4. Define click callback for the new app button
5. Create application
*/

enum AppType {
    Modeller,
    World
}

class AppElement {
    div: HTMLDivElement;
    button: HTMLButtonElement;
    
    constructor(in_div: HTMLDivElement, in_button: HTMLButtonElement) {
        this.div = in_div;
        this.button = in_button;
    }
}

const HEADER_BUTTON_MODELLER_ID = "header_modeller";
const HEADER_BUTTON_WORLD_ID = "header_world";

const WORKSPACE_MODELLER_ID = "modeller";
const WORKSPACE_WORLD_ID = "world_nodes";

// at the app is start we show modeller workspace and hide others
const modeller_div = document.getElementById(WORKSPACE_MODELLER_ID) as HTMLDivElement;
const world_div = document.getElementById(WORKSPACE_WORLD_ID) as HTMLDivElement;

// store all divs in the map: key - app type, value - element
const app_elements = new Map<AppType, AppElement>();

// buttons
const modeller_button = document.getElementById(HEADER_BUTTON_MODELLER_ID) as HTMLButtonElement;
const world_button = document.getElementById(HEADER_BUTTON_WORLD_ID) as HTMLButtonElement;

app_elements.set(AppType.Modeller, new AppElement(modeller_div, modeller_button));
app_elements.set(AppType.World, new AppElement(world_div, world_button));

function activate_app(type: AppType) {
    for (const [app_type, app_element] of app_elements) {
        if (app_type == type) {
            app_element.button.classList.add("active");
            app_element.div.style.display = "";
        } else {
            app_element.button.classList.remove("active");
            app_element.div.style.display = "none";
        }
    }
}

// add buttons callbacks
modeller_button.addEventListener("click", function() { activate_app(AppType.Modeller); });
world_button.addEventListener("click", function() { activate_app(AppType.World); });

activate_app(AppType.Modeller);

// and create modeller application
const modeller_app = new ModellerApp(modeller_div);