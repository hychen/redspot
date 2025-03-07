/* eslint-disable no-use-before-define */
import BN from 'bn.js';
import { Artifacts } from './artifacts';
import { NetworkConfig, RedspotConfig } from './config';
import {
  ApiPromise,
  Keyring,
  LocalKeyringPair,
  Registry,
  Signer,
  WsProvider
} from './provider';

/**
 * This class is used to dynamically validate task's argument types.
 */
export interface ArgumentType<T> {
  /**
   * The type's name.
   */
  name: string;

  /**
   * Check if argument value is of type <T>.
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param argumentValue - value to be validated
   *
   * @throws RS301 if value is not of type <t>
   */
  validate(argName: string, argumentValue: any): void;
}

/**
 * This is a special case of ArgumentType.
 *
 * These types must have a human-friendly string representation, so that they
 * can be used as command line arguments.
 */
export interface CLIArgumentType<T> extends ArgumentType<T> {
  /**
   * Parses strValue into T. This function MUST throw RS301 if it
   * can parse the given value.
   *
   * @param argName argument's name - used for context in case of error.
   * @param strValue argument's string value to be parsed.
   */
  parse(argName: string, strValue: string): T;
}

export interface ConfigurableTaskDefinition {
  setDescription(description: string): this;

  setAction(action: ActionType<TaskArguments>): this;

  addParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: ArgumentType<T>,
    isOptional?: boolean
  ): this;

  addOptionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: ArgumentType<T>
  ): this;

  addPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: ArgumentType<T>,
    isOptional?: boolean
  ): this;

  addOptionalPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: ArgumentType<T>
  ): this;

  addVariadicPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T[],
    type?: ArgumentType<T>,
    isOptional?: boolean
  ): this;

  addOptionalVariadicPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T[],
    type?: ArgumentType<T>
  ): this;

  addFlag(name: string, description?: string): this;
}

export interface ParamDefinition<T> {
  name: string;
  defaultValue?: T;
  type: ArgumentType<T>;
  description?: string;
  isOptional: boolean;
  isFlag: boolean;
  isVariadic: boolean;
}

export interface OptionalParamDefinition<T> extends ParamDefinition<T> {
  defaultValue: T;
  isOptional: true;
}

export interface CLIOptionalParamDefinition<T>
  extends OptionalParamDefinition<T> {
  type: CLIArgumentType<T>;
}

export interface ParamDefinitionsMap {
  [paramName: string]: ParamDefinition<any>;
}

export interface TaskDefinition extends ConfigurableTaskDefinition {
  readonly name: string;
  readonly description?: string;
  readonly action: ActionType<TaskArguments>;
  readonly isSubtask: boolean;

  // TODO: Rename this to something better. It doesn't include the positional
  // params, and that's not clear.
  readonly paramDefinitions: ParamDefinitionsMap;

  readonly positionalParamDefinitions: Array<ParamDefinition<any>>;
}

/**
 * @type TaskArguments {object-like} - the input arguments for a task.
 *
 * TaskArguments type is set to 'any' because it's interface is dynamic.
 * It's impossible in TypeScript to statically specify a variadic
 * number of fields and at the same time define specific types for\
 * the argument values.
 *
 * For example, we could define:
 * type TaskArguments = Record<string, any>;
 *
 * ...but then, we couldn't narrow the actual argument value's type in compile time,
 * thus we have no other option than forcing it to be just 'any'.
 */
export type TaskArguments = any;

export interface RunSuperFunction<ArgT extends TaskArguments> {
  (taskArguments?: ArgT): Promise<any>;
  isDefined: boolean;
}

export type ActionType<ArgsT extends TaskArguments> = (
  taskArgs: ArgsT,
  env: RedspotRuntimeEnvironment,
  runSuper: RunSuperFunction<ArgsT>
) => Promise<any>;

export interface RedspotArguments {
  network?: string;
  showStackTraces: boolean;
  version: boolean;
  help: boolean;
  config?: string;
  verbose: boolean;
  logLevel: string;
  maxMemory?: number;
  tsconfig?: string;
}

export type RedspotParamDefinitions = {
  [param in keyof Required<RedspotArguments>]: CLIOptionalParamDefinition<
    RedspotArguments[param]
  >;
};

export interface TasksMap {
  [name: string]: TaskDefinition;
}

export type RunTaskFunction = (
  name: string,
  taskArguments?: TaskArguments
) => Promise<any>;

export interface RuntimeEnvironment {
  readonly config: RedspotConfig;
  readonly redspotArguments: RedspotArguments;
  readonly tasks: TasksMap;
  readonly run: RunTaskFunction;
  readonly network: Network;
  readonly artifacts: Artifacts;
}

export interface RedspotRuntimeEnvironment {
  readonly config: RedspotConfig;
  readonly redspotArguments: RedspotArguments;
  readonly tasks: TasksMap;
  readonly run: RunTaskFunction;
  readonly network: Network;
  readonly artifacts: Artifacts;
}

export interface Network {
  name: string;
  config: NetworkConfig;
  provider: WsProvider;
  api: ApiPromise;
  registry: Registry;
  keyring: Keyring;
  getSigners(): Promise<Signer[]>;
  createSigner(pair: LocalKeyringPair): Signer;
  gasLimit?: BN;
  explorerUrl?: string;
  utils: {
    encodeSalt(
      salt?: Uint8Array | string | null,
      signer?: Signer
    ): Promise<Uint8Array>;
  };
}

/**
 * A function that receives a RedspotRuntimeEnvironment and
 * modify its properties or add new ones.
 */
export type EnvironmentExtender = (env: RuntimeEnvironment) => void;
