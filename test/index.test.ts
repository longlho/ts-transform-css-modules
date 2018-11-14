import compile from "../compile";
import { resolve } from "path";
import { expect } from "chai";
import { readFileSync } from "fs";
const validate = require("sourcemap-validator");

describe("ts-transform-css-modules", function() {
  this.timeout(5000);
  beforeEach(function() {
    compile(resolve(__dirname, "fixture/*.ts"));
  });
  it("should be able to compile CSS", function() {
    expect(require("./fixture/index.js").default()).to.deep.equal({
      bar: "foo__bar___3dUjP foo__foo___3p56d",
      bar2: "bar__bar2___2PTAu bar__foo2___3ly2x",
      foo: "foo__foo___3p56d",
      foo2: "bar__foo2___3ly2x",
      "foo-asd": "bar__foo-asd___9jX6V",
      goo: "baz__goo___1DlUX",
      absoluteFoo: {
        bar: "foo__bar___3dUjP foo__foo___3p56d",
        foo: "foo__foo___3p56d"
      }
    });
  });

  it("should produce correct source map", function() {
    validate(
      readFileSync(resolve(__dirname, "./fixture/index.js"), "utf-8"),
      readFileSync(resolve(__dirname, "./fixture/index.js.map"), "utf-8"),
      {
        "index.ts": readFileSync(
          resolve(__dirname, "./fixture/index.ts"),
          "utf-8"
        )
      }
    );
  });
});
