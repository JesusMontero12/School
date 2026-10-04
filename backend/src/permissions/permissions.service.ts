import { Injectable } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private repo: PermissionsRepository) {}

  /** Catálogo agrupado por módulo: { module, permissions[] }[] */
  async listGrouped() {
    const all = await this.repo.findAll();
    const groups = new Map<string, typeof all>();
    for (const p of all) groups.set(p.module, [...(groups.get(p.module) ?? []), p]);
    return [...groups].map(([module, permissions]) => ({ module, permissions }));
  }
  countByIds(ids: string[]) { return this.repo.countByIds(ids); }
}
