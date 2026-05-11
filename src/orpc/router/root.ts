import { pub } from "..";
import {
  listFungi,
  findFungus,
  createFungus,
  updateFungus,
  deleteFungus,
} from "#/domains/fungi/fungi.router";

const router = pub.router({
  fungi: {
    list: listFungi,
    find: findFungus,
    create: createFungus,
    update: updateFungus,
    delete: deleteFungus,
  },
});

export default router;
