// processor.ts

import { Logger } from "./logger";
import { LogLevel, type Character, type ProcessedResult } from "./types";
import type { ProcessableContent } from "./types";
import type { HandlerInterface } from "./new";
import type { MemoryManager } from "./memory";
import type { z } from "zod";

export interface ProcessorInterface {
    // hold the schema
    outputSchema: z.ZodType;

    // hold the processors
    processors: Map<string, BaseProcessor>;

    // hold the always child processor
    alwaysChildProcessor?: BaseProcessor;

    // hold the IOHandlers
    handlers: HandlerInterface;

    // based on inputs and outputs
    process: (content: ProcessableContent) => Promise<ProcessedResult>;

    // based on inputs and outputs
    evaluate: (result: ProcessedResult) => Promise<boolean>;

    // memory manager // what it's done
    // memory: MemoryManager;
}

export abstract class BaseProcessor implements ProcessorInterface {
    /** Logger instance for this processor */
    protected logger: Logger;
    /** Map of child processors (sub-processors) that this processor can delegate to */
    public processors: Map<string, BaseProcessor> = new Map();

    constructor(
        public outputSchema: z.ZodType,
        public handlers: HandlerInterface,
        // public memory: MemoryManager,
        protected metadata: { name: string; description: string },
        protected loggerLevel: LogLevel,
        protected character: Character,
        protected llmClient: any, // your LLM client type
        protected contentLimit: number = 1000,
        public alwaysChildProcessor?: BaseProcessor,
    ) {
        this.logger = new Logger({
            level: loggerLevel,
            enableColors: true,
            enableTimestamp: true,
        });
    }

    /**
     * Gets the name of this processor
     */
    public getName(): string {
        return this.metadata.name;
    }

    /**
     * Gets the description of this processor
     */
    public getDescription(): string {
        return this.metadata.description;
    }

    /**
     * Determines if this processor can handle the given content.
     */
    public abstract canHandle(content: any): boolean;

    /**
     * Processes the given content and returns a result.
     */
    public abstract process(
        content: ProcessableContent
    ): Promise<ProcessedResult>;

    /**
     * Adds one or more child processors to this processor
     */
    public addProcessor(processors: BaseProcessor | BaseProcessor[]): this {
        const toAdd = Array.isArray(processors) ? processors : [processors];

        for (const processor of toAdd) {
            const name = processor.getName();
            if (this.processors.has(name)) {
                throw new Error(`Processor with name '${name}' already exists`);
            }
            this.processors.set(name, processor);
        }
        return this;
    }

    /**
     * Gets a child processor by name
     */
    public getProcessor(name: string): BaseProcessor | undefined {
        return this.processors.get(name);
    }

    public abstract evaluate(result: ProcessedResult): Promise<boolean>;
}
