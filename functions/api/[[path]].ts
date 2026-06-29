import app from "../../src/server";

export const onRequest: PagesFunction = (context) => {
  return app.fetch(context.request, context.env);
};
