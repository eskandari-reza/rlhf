import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";

@Controller("me")
@UseGuards(AuthGuard)
export class MeController {
  @Get()
  me(@Req() req: { user: unknown }) {
    return req.user;
  }
}