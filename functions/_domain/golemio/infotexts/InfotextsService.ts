import type { AppInfotext, CityRequestContext } from "../../../_core/types";
import type { InfotextsUseCase } from "../../use-cases";
import { getGolemioInfotexts } from "../../../_feeds/golemio/infotexts";
import { InfotextsMapper } from "./InfotextsMapper";

/** PID stop notice banners, filtered and normalized. */
export class InfotextsService implements InfotextsUseCase {
    async getInfotexts(ctx: CityRequestContext): Promise<AppInfotext[]> {
        return InfotextsMapper.map(await getGolemioInfotexts(ctx.env));
    }
}
