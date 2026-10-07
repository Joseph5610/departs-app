import type { AppInfotext, CityRequestContext } from "../../../_core/types";
import type { InfotextsUseCase } from "../../useCases";
import { getGolemioInfotexts } from "../../../_feeds/golemio/infotexts";
import { mapInfotexts } from "./infotextsMapper";

/** PID stop notice banners, filtered and normalized. */
export class InfotextsService implements InfotextsUseCase {
    async getInfotexts(ctx: CityRequestContext): Promise<AppInfotext[]> {
        return mapInfotexts(await getGolemioInfotexts(ctx.env));
    }
}
