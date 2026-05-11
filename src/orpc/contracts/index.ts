import {
  listFungiContract,
  findFungusContract,
  createFungusContract,
  updateFungusContract,
  deleteFungusContract,
} from "#/domains/fungi/fungi.contract";

export const contract = {
  fungi: {
    list: listFungiContract,
    find: findFungusContract,
    create: createFungusContract,
    update: updateFungusContract,
    delete: deleteFungusContract,
  },
};
