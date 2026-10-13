import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HealthController } from "./health.controller";
import { MeController } from "./me.controller";
import { RlhfController } from "./rlhf.controller";

@Module({
  imports: [],
  controllers: [AppController, HealthController,MeController,RlhfController],
  providers: [AppService],
})
export class AppModule {}