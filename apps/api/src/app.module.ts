import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HealthController } from "./health.controller";
import { MeController } from "./me.controller";

@Module({
  imports: [],
  controllers: [AppController, HealthController,MeController],
  providers: [AppService],
})
export class AppModule {}