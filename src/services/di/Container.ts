// src/services/di/Container.ts

type Constructor<T = any> = new (...args: any[]) => T;
type Factory<T = any> = (...args: any[]) => T;
type ServiceDefinition<T = any> = Constructor<T> | Factory<T>;

export enum ServiceLifetime {
  SINGLETON = 'singleton',
  TRANSIENT = 'transient',
  SCOPED = 'scoped'
}

interface ServiceRegistration {
  definition: ServiceDefinition;
  lifetime: ServiceLifetime;
  instance?: any;
  dependencies?: string[];
}

export class Container {
  private services = new Map<string, ServiceRegistration>();
  private scopedInstances = new Map<string, any>();

  /**
   * Register a service
   */
  register<T>(
    name: string,
    definition: ServiceDefinition<T>,
    lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
    dependencies: string[] = []
  ): void {
    this.services.set(name, {
      definition,
      lifetime,
      dependencies
    });
  }

  /**
   * Register singleton
   */
  singleton<T>(name: string, definition: ServiceDefinition<T>, dependencies: string[] = []): void {
    this.register(name, definition, ServiceLifetime.SINGLETON, dependencies);
  }

  /**
   * Register transient
   */
  transient<T>(name: string, definition: ServiceDefinition<T>, dependencies: string[] = []): void {
    this.register(name, definition, ServiceLifetime.TRANSIENT, dependencies);
  }

  /**
   * Resolve a service
   */
  resolve<T>(name: string): T {
    const registration = this.services.get(name);

    if (!registration) {
      throw new Error(`Service "${name}" not registered`);
    }

    // Return existing singleton
    if (registration.lifetime === ServiceLifetime.SINGLETON && registration.instance) {
      return registration.instance;
    }

    // Return existing scoped instance
    if (registration.lifetime === ServiceLifetime.SCOPED && this.scopedInstances.has(name)) {
      return this.scopedInstances.get(name);
    }

    // Resolve dependencies
    const dependencies = registration.dependencies?.map(dep => this.resolve(dep)) || [];

    // Create instance
    const instance = this.createInstance(registration.definition, dependencies);

    // Cache if needed
    if (registration.lifetime === ServiceLifetime.SINGLETON) {
      registration.instance = instance;
    } else if (registration.lifetime === ServiceLifetime.SCOPED) {
      this.scopedInstances.set(name, instance);
    }

    return instance;
  }

  /**
   * Check if service exists
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Clear all scoped instances
   */
  clearScope(): void {
    this.scopedInstances.clear();
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
    this.scopedInstances.clear();
  }

  /**
   * Get all registered service names
   */
  getServices(): string[] {
    return Array.from(this.services.keys());
  }

  private createInstance<T>(definition: ServiceDefinition<T>, dependencies: any[]): T {
    // Check if constructor or factory
    if (this.isConstructor(definition)) {
      return new definition(...dependencies);
    } else {
      return definition(...dependencies);
    }
  }

  private isConstructor(obj: any): obj is Constructor {
    return obj.prototype && obj.prototype.constructor === obj;
  }
}

// Global container instance
let containerInstance: Container | null = null;

export function getContainer(): Container {
  if (!containerInstance) {
    containerInstance = new Container();
  }
  return containerInstance;
}

export function resetContainer(): void {
  containerInstance = new Container();
}