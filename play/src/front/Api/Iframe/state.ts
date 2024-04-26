import {ZodObject} from "zod";
import { queryWorkadventure } from "./IframeApiContribution";
import { apiCallback } from "./registeredCallbacks";
import { AbstractWorkadventureStateCommands } from "./AbstractState";

export class WorkadventureStateCommands extends AbstractWorkadventureStateCommands {
    public constructor() {
        super();
    }

    callbacks = [
        apiCallback({
            type: "setVariable",
            callback: (payloadData) => {
                this.setVariableResolvers.next(payloadData);
            },
        }),
    ];

    saveVariable(key: string, value: unknown): Promise<void> {
        // Let's not save anything if the value has not changed (and if it is a primitive type)
        if (this.variables.get(key) === value && typeof value !== "object") {
            return Promise.resolve();
        }

        this.variables.set(key, value);

        const subscriber = this.variableSubscribers.get(key);
        if (subscriber) {
            subscriber.next(value);
        }

        return queryWorkadventure({
            type: "setVariable",
            data: {
                key,
                value,
            },
        });
    }

    /**
     * Build a Typesafe version of the state object.
     * Types are checked using the Zod object passed in parameter.
     */
    buildValidatedState(zodObject: ZodObject): any {
        return zodObject.parse(state);
    }
}

// TODO: rework this function to be able to create a WorkadventurePlayerStateCommands too! (something like: "wrapInProxy")
export function createState(): WorkadventureStateCommands & { [key: string]: unknown } {
    return new Proxy(new WorkadventureStateCommands(), {
        get(target: WorkadventureStateCommands, p: PropertyKey, receiver: unknown): unknown {
            if (p in target) {
                return Reflect.get(target, p, receiver);
            }
            return target.loadVariable(p.toString());
        },
        set(target: WorkadventureStateCommands, p: PropertyKey, value: unknown, receiver: unknown): boolean {
            // Note: when using "set", there is no way to wait, so we ignore the return of the promise.
            // User must use WA.state.saveVariable to have error message.
            target.saveVariable(p.toString(), value).catch((e) => console.error(e));
            return true;
        },
        has(target: WorkadventureStateCommands, p: PropertyKey): boolean {
            if (p in target) {
                return true;
            }
            return target.hasVariable(p.toString());
        },
    }) as WorkadventureStateCommands & { [key: string]: unknown };
}
