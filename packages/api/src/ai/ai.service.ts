// packages/api/src/ai/ai.service.ts
import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { Role } from '@prisma/client';

interface ChatRequest {
  question: string;
  sessionId?: string;
}

interface AiEngineResponse {
  answer: string;
  sources: Array<{
    docId: string;
    title: string;
    deptName: string;
    excerpt: string;
  }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiEngineUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.aiEngineUrl = this.config.get<string>('AI_ENGINE_URL', 'http://localhost:8000');
  }

  async chat(
    dto: ChatRequest,
    userId: string,
    userRole: Role,
    userDeptId: string | null,
  ) {
    // Determine which departments this user can access
    let deptIds: string[];

    if (userRole === Role.SUPER_ADMIN || userRole === Role.DEPT_ADMIN) {
      // Admins can access all departments
      const allDepts = await this.prisma.department.findMany({
        select: { id: true },
      });
      deptIds = allDepts.map((d) => d.id);
    } else {
      // EMPLOYEE / DEPT_EDITOR: restricted to their own department
      deptIds = userDeptId ? [userDeptId] : [];
    }

    // Build the payload for the AI engine
    const payload = {
      question: dto.question,
      session_id: dto.sessionId,
      user_id: userId,
      dept_ids: deptIds,
    };

    let aiResponse: AiEngineResponse;

    try {
      const response = await fetch(`${this.aiEngineUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`AI engine returned ${response.status}: ${errorText}`);
        throw new BadGatewayException('AI service is temporarily unavailable, please try again later');
      }

      aiResponse = await response.json();
    } catch (err) {
      if (err instanceof BadGatewayException) throw err;
      this.logger.error('AI engine request failed:', err?.message);
      throw new BadGatewayException('AI service is temporarily unavailable, please try again later');
    }

    // Persist chat history
    const history = await this.prisma.chatHistory.create({
      data: {
        userId,
        question: dto.question,
        answer: aiResponse.answer,
        sources: aiResponse.sources ?? [],
      },
    });

    return {
      id: history.id,
      answer: aiResponse.answer,
      sources: aiResponse.sources ?? [],
      createdAt: history.createdAt,
    };
  }

  async getHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.chatHistory.count({ where: { userId } }),
      this.prisma.chatHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
