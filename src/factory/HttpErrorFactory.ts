import {Inject, Injectable, ProviderScope} from "@tsed/di";
import {Exception} from "@tsed/exceptions";
import type {IHttpErrorRenderEngine} from "../engine/IHttpErrorRenderEngine.js";
import {HTTP_RENDER_ENGINE} from "../model/di/tokens.js";
import {DefaultHttpRenderEngine} from "../engine/impl/HttpErrorRenderers/index.js";

@Injectable({
    scope: ProviderScope.SINGLETON
})
export class HttpErrorFactory {

    private readonly defaultRenderEngine: IHttpErrorRenderEngine<unknown>;

    public constructor(
        @Inject(HTTP_RENDER_ENGINE) private readonly engines: IHttpErrorRenderEngine<unknown>[]
    ) {
        this.defaultRenderEngine = engines.find(engine => engine instanceof DefaultHttpRenderEngine)!;
    }

    public getRenderEngine(exception: Exception): IHttpErrorRenderEngine<unknown> {
        return this.engines.find(engine => engine.supportsError(exception)) ?? this.defaultRenderEngine;
    }

}
