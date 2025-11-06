import { KnowledgeFileListResponse, KnowledgeFileContentResponse, KnowledgeDownloadResponse } from '../types/knowledge';
import { KnowledgeFile } from '../types/knowledge';

// 静态数据：根目录下的目录列表
const rootDirectories: KnowledgeFile[] = [
  {
    key: '舆情数据/',
    type: 'directory',
    size: 0,
    last_modified: 0,
    etag: '',
  },
  {
    key: '行业数据/',
    type: 'directory',
    size: 0,
    last_modified: 0,
    etag: '',
  },
  {
    key: '公司数据/',
    type: 'directory',
    size: 0,
    last_modified: 0,
    etag: '',
  },
  {
    key: '另类数据/',
    type: 'directory',
    size: 0,
    last_modified: 0,
    etag: '',
  },
  {
    key: '因子数据/',
    type: 'directory',
    size: 0,
    last_modified: 0,
    etag: '',
  },
];

// 生成时间戳（最近30天内的随机时间）
const getRandomTimestamp = () => {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
  return Math.floor(Math.random() * (now - thirtyDaysAgo) + thirtyDaysAgo);
};

// 生成文件大小（KB到MB范围）
const getRandomSize = (minKB: number, maxKB: number) => {
  return Math.floor(Math.random() * (maxKB - minKB) + minKB) * 1024;
};

// 文件内容映射
const fileContents: Record<string, string> = {
  '因子数据/『中性化』产权比率.md': `『中性化』产权比率
因子公式

负债合计/归属母公司所有者权益合计
因子实现

\`\`\`python
from jqfactor import Factor
import numpy as np
import pandas as pd

class DebtEquityRatio(Factor):
    name = 'debt_to_equity_ratio'
    max_window = 1
    dependencies = ['total_liability','equities_parent_company_owners',
                    # 以下为中性化需要使用的数据
                    'market_cap',
                    'HY001','HY002','HY003',
                    'HY004','HY005','HY006',
                    'HY007','HY008','HY009',
                    'HY010','HY011']

    def calc(self, data):
        tl = data['total_liability']
        epco = data['equities_parent_company_owners']
        result = tl / epco
        return neutralization(data, result.mean())

# 行业市值中性化
def neutralization(data, factor):
    from statsmodels.api import OLS
    industry_exposure = pd.DataFrame(index=data['HY001'].columns)
    industry_list = ['HY001','HY002','HY003','HY004','HY005',
                    'HY006','HY007','HY008','HY009','HY010','HY011']
    for key, value in data.items():
        if key in industry_list:
            industry_exposure[key]=value.iloc[-1]
    market_cap_exposure = data['market_cap'].iloc[-1]
    total_exposure = pd.concat([market_cap_exposure,industry_exposure],axis=1)
    result = OLS(factor, total_exposure, missing='drop').fit().resid
    return result
\`\`\``,

  '因子数据/『价量』alpha 191 中的 013.md': `『价量』alpha 191 中的 013
因子链接

alpha_013
因子公式

(((HIGH*LOW)^0.5)-VWAP)
因子实现

\`\`\`python
from jqfactor import Factor
import numpy as np 

class ALPHA013(Factor):
    # 设置因子名称
    name = 'alpha013'
    # 设置获取数据的时间窗口长度
    max_window = 1
    # 设置依赖的数据
    dependencies = ['high','low','volume','money']

    # 计算因子的函数， 需要返回一个 pandas.Series, index 是股票代码，value 是因子值
    def calc(self, data):

    # 最高价的 dataframe ， index 是日期， column 是股票代码
        high = data['high']

        # 最低价的 dataframe ， index 是日期， column 是股票代码
        low = data['low']

        #计算 vwap
        vwap = data['money']/data['volume']

        # 返回因子值， 这里求平均值是为了把只有一行的 dataframe 转成 series
        return (np.power(high*low,0.5) - vwap).mean()
\`\`\``,

  '因子数据/『基本面』gross profitability.md': `『基本面』gross profitability
参考链接

首席质量因子 - Gross Profitability -- 小兵哥
因子公式

(total_operating_revenue - total_operating_cost) / total_assets
因子实现

\`\`\`python
from jqfactor import Factor

class GROSSPROFITABILITY(Factor):
    # 设置因子名称
    name = 'gross_profitability'
    # 设置获取数据的时间窗口长度
    max_window = 1
    # 设置依赖的数据
    # 在策略中需要使用 get_fundamentals 获取的 income.total_operating_revenue, 在这里可以直接写做total_operating_revenue。 其他数据同理。
    dependencies = ['total_operating_revenue','total_operating_cost','total_assets']

    # 计算因子的函数， 需要返回一个 pandas.Series, index 是股票代码，value 是因子值
    def calc(self, data):
        # 获取单季度的营业总收入数据 , index 是日期，column 是股票代码， value 是营业总收入
        total_operating_revenue = data['total_operating_revenue']
        # 获取单季度的营业总成本数据
        total_operating_cost = data['total_operating_cost']
        # 获取总资产
        total_assets = data['total_assets']
        # 计算 gross_profitability
        gross_profitability = (total_operating_revenue - total_operating_cost)/total_assets
        # 由于 gross_profitability 是一个一行 n 列的 dataframe，可以直接求 mean 转成 series
        return gross_profitability.mean()
\`\`\``,

  '因子数据/『基本面』近两年净利润增长率.md': `『基本面』近两年净利润增长率
因子公式

最新一年度的净利润/上一年度的净利润 -1
因子实现

\`\`\`python
from jqfactor import Factor

class NetProfitGrowth(Factor):
    # 设置因子名称
    name = 'net_profit_growth_rate'
    # 设置获取数据的时间窗口长度
    max_window = 1
    # 设置依赖的数据
    dependencies = ['net_profit_y','net_profit_y1']

    # 计算因子的函数， 需要返回一个 pandas.Series, index 是股票代码，value 是因子值
    def calc(self, data):
        # 个股最新一年度的净利润数据
        net_profit_y = data['net_profit_y']
        # 个股最新一年度的上一年的净利润数据
        net_profit_y1 = data['net_profit_y1']
        # 计算增长率
        growth = net_profit_y/net_profit_y1 - 1
        # 返回一个 series
        return growth.mean()
\`\`\``,

  '因子数据/『多季度』 资产回报率.md': `『多季度』 资产回报率
因子公式

过去四个季度的净利润之和/期末总资产
因子实现

\`\`\`python
class ROATTM(Factor):
    name = 'roa_ttm'
    max_window = 1
    # 定义依赖的数据： 过去四个季度的净利润， 以及最新一个季度的总资产
    dependencies = ['net_profit', 'net_profit_1', 'net_profit_2', 'net_profit_3',
                    'total_assets']

    def calc(self, data):
        # 计算净利润的 ttm 值
        net_profit_ttm = data['net_profit'] + data['net_profit_1'] + data['net_profit_2'] + data['net_profit_3']
        # 计算 ROA
        result = net_profit_ttm / data['total_assets']
        # 把结果转成一个 series
        return result.mean()
\`\`\``,

  '因子数据/『指数』近10日 alpha.md': `『指数』近10日 alpha
因子公式

个股近10日收益 - 指数（沪深300）近10日收益 近10日收益计算方法： (第10日价格/第1日价格) - 1
因子实现

\`\`\`python
from jqfactor import Factor

class Hs300Alpha(Factor):
    # 设置因子名称
    name = 'hs300_alpha'
    # 设置获取数据的时间窗口长度
    max_window = 10
    # 设置依赖的数据
    dependencies = ['close']

    # 计算因子的函数， 需要返回一个 pandas.Series, index 是股票代码，value 是因子值
    def calc(self, data):
        # 获取个股的收盘价数据
        close = data['close']
        # 计算个股近10日收益
        stock_return = close.iloc[-1,:]/close.iloc[0,:] -1
        # 获取指数（沪深300）的收盘价数据
        index_close = self._get_extra_data(securities=['000300.XSHG'], fields=['close'])['close']
        # 计算指数的近10日收益
        index_return = index_close.iat[-1,0]/index_close.iat[0,0] - 1
        # 计算 alpha
        alpha = stock_return - index_return
        return alpha
\`\`\``,

  '因子数据/『构建因子数据进行单因子分析』.md': `构建因子数据进行单因子分析
前面的例子讲述了通过自定义类实现因子，本例讲解如何直接获取因子数据或者构建因子数据，然后对得到的数据进行单因子分析。
其中的factor_data数据需要自己获取，并整理成符合因子分析要求的格式。
更多关于factor_data数据格式请查看单因子分析框架jqfactor_analyzer

\`\`\`python
# 载入函数库
from jqfactor import analyze_factor
from jqdata import *
from jqlib import alpha191
import pandas as pd
import warnings
warnings.filterwarnings("ignore")

# 测试开始时间
start_date = '2019-10-01'
# 测试结束时间
end_date = '2019-11-11'
# 测试时间区间的交易日
date_list = get_trade_days(start_date=start_date, end_date=end_date)
# 转换交易日时间的数据类型
# date_list = [date.strftime('%Y-%m-%d') for date in date_list]

# 获取一段时间股票池191因子数据
factor_data = {}
# 循环获取每天数据
for date in date_list:
    # 获取每天的股票池
    universe = get_index_stocks('000300.XSHG', date=date)
    # 获取每天股票池的因子数据
    _factor_data = alpha191.alpha_002(code=universe, end_date=date, fq='post')
    # 添加每天的因子数据
    factor_data[date] = _factor_data

# 将字典类型数据转换为DataFrame
factor_data = pd.DataFrame(factor_data).T
# 将 index 转换为 DatetimeIndex
factor_data.index = pd.to_datetime(factor_data.index)

# 对因子进行分析，参数使用默认值
far = analyze_factor(factor=factor_data, )
# 展示全部分析
far.create_full_tear_sheet(demeaned=False, group_adjust=False, by_group=False, turnover_periods=None, 
                           avgretplot=(5, 15), std_bar=False)
\`\`\``,
};

// 模拟每个目录下的文件
const getFilesByPrefix = (prefix: string): KnowledgeFile[] => {
  // 舆情数据目录
  if (prefix === '舆情数据/' || prefix.startsWith('舆情数据/')) {
    return [
      {
        key: '舆情数据/2024年1月新闻舆情分析.md',
        type: 'file',
        size: getRandomSize(50, 200),
        last_modified: getRandomTimestamp(),
        etag: 'etag-yuqing-001',
      },
      {
        key: '舆情数据/社交媒体情绪指数报告.csv',
        type: 'file',
        size: getRandomSize(100, 500),
        last_modified: getRandomTimestamp(),
        etag: 'etag-yuqing-002',
      },
      {
        key: '舆情数据/论坛讨论热度数据.json',
        type: 'file',
        size: getRandomSize(80, 300),
        last_modified: getRandomTimestamp(),
        etag: 'etag-yuqing-003',
      },
      {
        key: '舆情数据/2024年2月舆情监控报告.md',
        type: 'file',
        size: getRandomSize(60, 250),
        last_modified: getRandomTimestamp(),
        etag: 'etag-yuqing-004',
      },
      {
        key: '舆情数据/财经新闻关键词分析.xlsx',
        type: 'file',
        size: getRandomSize(150, 400),
        last_modified: getRandomTimestamp(),
        etag: 'etag-yuqing-005',
      },
      {
        key: '舆情数据/行业舆情趋势分析.md',
        type: 'file',
        size: getRandomSize(70, 180),
        last_modified: getRandomTimestamp(),
        etag: 'etag-yuqing-006',
      },
      {
        key: '舆情数据/上市公司舆情监控数据.csv',
        type: 'file',
        size: getRandomSize(200, 600),
        last_modified: getRandomTimestamp(),
        etag: 'etag-yuqing-007',
      },
      {
        key: '舆情数据/2024年Q1舆情总结报告.md',
        type: 'file',
        size: getRandomSize(90, 220),
        last_modified: getRandomTimestamp(),
        etag: 'etag-yuqing-008',
      },
    ];
  }

  // 行业数据目录
  if (prefix === '行业数据/' || prefix.startsWith('行业数据/')) {
    return [
      {
        key: '行业数据/金融行业分析报告.md',
        type: 'file',
        size: getRandomSize(100, 300),
        last_modified: getRandomTimestamp(),
        etag: 'etag-industry-001',
      },
      {
        key: '行业数据/科技行业数据统计.csv',
        type: 'file',
        size: getRandomSize(150, 500),
        last_modified: getRandomTimestamp(),
        etag: 'etag-industry-002',
      },
      {
        key: '行业数据/制造业发展趋势分析.md',
        type: 'file',
        size: getRandomSize(80, 250),
        last_modified: getRandomTimestamp(),
        etag: 'etag-industry-003',
      },
      {
        key: '行业数据/能源行业数据报告.xlsx',
        type: 'file',
        size: getRandomSize(200, 600),
        last_modified: getRandomTimestamp(),
        etag: 'etag-industry-004',
      },
      {
        key: '行业数据/消费行业研究报告.md',
        type: 'file',
        size: getRandomSize(90, 280),
        last_modified: getRandomTimestamp(),
        etag: 'etag-industry-005',
      },
      {
        key: '行业数据/医药行业数据分析.json',
        type: 'file',
        size: getRandomSize(120, 350),
        last_modified: getRandomTimestamp(),
        etag: 'etag-industry-006',
      },
      {
        key: '行业数据/房地产行业市场分析.md',
        type: 'file',
        size: getRandomSize(100, 320),
        last_modified: getRandomTimestamp(),
        etag: 'etag-industry-007',
      },
      {
        key: '行业数据/交通运输行业数据.csv',
        type: 'file',
        size: getRandomSize(180, 450),
        last_modified: getRandomTimestamp(),
        etag: 'etag-industry-008',
      },
      {
        key: '行业数据/2024年行业趋势预测.md',
        type: 'file',
        size: getRandomSize(110, 270),
        last_modified: getRandomTimestamp(),
        etag: 'etag-industry-009',
      },
    ];
  }

  // 公司数据目录
  if (prefix === '公司数据/' || prefix.startsWith('公司数据/')) {
    return [
      {
        key: '公司数据/上市公司财务数据2024Q1.csv',
        type: 'file',
        size: getRandomSize(200, 800),
        last_modified: getRandomTimestamp(),
        etag: 'etag-company-001',
      },
      {
        key: '公司数据/公司治理评分报告.md',
        type: 'file',
        size: getRandomSize(80, 250),
        last_modified: getRandomTimestamp(),
        etag: 'etag-company-002',
      },
      {
        key: '公司数据/市值前100公司数据.xlsx',
        type: 'file',
        size: getRandomSize(300, 1000),
        last_modified: getRandomTimestamp(),
        etag: 'etag-company-003',
      },
      {
        key: '公司数据/公司业绩公告汇总.md',
        type: 'file',
        size: getRandomSize(100, 300),
        last_modified: getRandomTimestamp(),
        etag: 'etag-company-004',
      },
      {
        key: '公司数据/上市公司ESG评分数据.csv',
        type: 'file',
        size: getRandomSize(150, 500),
        last_modified: getRandomTimestamp(),
        etag: 'etag-company-005',
      },
      {
        key: '公司数据/行业龙头公司分析报告.md',
        type: 'file',
        size: getRandomSize(90, 280),
        last_modified: getRandomTimestamp(),
        etag: 'etag-company-006',
      },
      {
        key: '公司数据/公司股东持股变化数据.json',
        type: 'file',
        size: getRandomSize(120, 400),
        last_modified: getRandomTimestamp(),
        etag: 'etag-company-007',
      },
      {
        key: '公司数据/上市公司公告数据.csv',
        type: 'file',
        size: getRandomSize(250, 700),
        last_modified: getRandomTimestamp(),
        etag: 'etag-company-008',
      },
      {
        key: '公司数据/公司基本面分析报告.md',
        type: 'file',
        size: getRandomSize(95, 320),
        last_modified: getRandomTimestamp(),
        etag: 'etag-company-009',
      },
      {
        key: '公司数据/2024年公司业绩预测数据.xlsx',
        type: 'file',
        size: getRandomSize(180, 550),
        last_modified: getRandomTimestamp(),
        etag: 'etag-company-010',
      },
    ];
  }

  // 另类数据目录
  if (prefix === '另类数据/' || prefix.startsWith('另类数据/')) {
    return [
      {
        key: '另类数据/卫星图像数据分析报告.md',
        type: 'file',
        size: getRandomSize(150, 400),
        last_modified: getRandomTimestamp(),
        etag: 'etag-alt-001',
      },
      {
        key: '另类数据/天气数据统计.csv',
        type: 'file',
        size: getRandomSize(200, 600),
        last_modified: getRandomTimestamp(),
        etag: 'etag-alt-002',
      },
      {
        key: '另类数据/交通流量数据分析.json',
        type: 'file',
        size: getRandomSize(180, 500),
        last_modified: getRandomTimestamp(),
        etag: 'etag-alt-003',
      },
      {
        key: '另类数据/手机信号数据统计.md',
        type: 'file',
        size: getRandomSize(100, 300),
        last_modified: getRandomTimestamp(),
        etag: 'etag-alt-004',
      },
      {
        key: '另类数据/社交媒体地理位置数据.csv',
        type: 'file',
        size: getRandomSize(250, 700),
        last_modified: getRandomTimestamp(),
        etag: 'etag-alt-005',
      },
      {
        key: '另类数据/网络搜索指数分析报告.md',
        type: 'file',
        size: getRandomSize(90, 280),
        last_modified: getRandomTimestamp(),
        etag: 'etag-alt-006',
      },
      {
        key: '另类数据/信用卡消费数据统计.xlsx',
        type: 'file',
        size: getRandomSize(300, 900),
        last_modified: getRandomTimestamp(),
        etag: 'etag-alt-007',
      },
      {
        key: '另类数据/船舶AIS数据追踪分析.md',
        type: 'file',
        size: getRandomSize(120, 350),
        last_modified: getRandomTimestamp(),
        etag: 'etag-alt-008',
      },
      {
        key: '另类数据/卫星夜光数据分析报告.md',
        type: 'file',
        size: getRandomSize(110, 320),
        last_modified: getRandomTimestamp(),
        etag: 'etag-alt-009',
      },
      {
        key: '另类数据/停车场占用率数据.csv',
        type: 'file',
        size: getRandomSize(150, 450),
        last_modified: getRandomTimestamp(),
        etag: 'etag-alt-010',
      },
    ];
  }

  // 因子数据目录
  if (prefix === '因子数据/' || prefix.startsWith('因子数据/')) {
    return [
      {
        key: '因子数据/『中性化』产权比率.md',
        type: 'file',
        size: getRandomSize(2, 5),
        last_modified: getRandomTimestamp(),
        etag: 'etag-factor-001',
      },
      {
        key: '因子数据/『价量』alpha 191 中的 013.md',
        type: 'file',
        size: getRandomSize(2, 5),
        last_modified: getRandomTimestamp(),
        etag: 'etag-factor-002',
      },
      {
        key: '因子数据/『基本面』gross profitability.md',
        type: 'file',
        size: getRandomSize(2, 5),
        last_modified: getRandomTimestamp(),
        etag: 'etag-factor-003',
      },
      {
        key: '因子数据/『基本面』近两年净利润增长率.md',
        type: 'file',
        size: getRandomSize(2, 5),
        last_modified: getRandomTimestamp(),
        etag: 'etag-factor-004',
      },
      {
        key: '因子数据/『多季度』 资产回报率.md',
        type: 'file',
        size: getRandomSize(2, 5),
        last_modified: getRandomTimestamp(),
        etag: 'etag-factor-005',
      },
      {
        key: '因子数据/『指数』近10日 alpha.md',
        type: 'file',
        size: getRandomSize(2, 5),
        last_modified: getRandomTimestamp(),
        etag: 'etag-factor-006',
      },
      {
        key: '因子数据/『构建因子数据进行单因子分析』.md',
        type: 'file',
        size: getRandomSize(3, 8),
        last_modified: getRandomTimestamp(),
        etag: 'etag-factor-007',
      },
    ];
  }

  // 默认返回空数组
  return [];
};

export const knowledgeAPI = {
  // 获取文件列表 - 使用静态数据
  async getFileList(params: { prefix?: string; delimiter?: string }): Promise<KnowledgeFileListResponse> {
    try {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 300));

      const prefix = params.prefix || '';
      
      // 如果是根目录，返回4个目录
      if (!prefix || prefix === '') {
        return {
          success: true,
          data: {
            files: [],
            directories: rootDirectories,
          },
        };
      }

      // 如果是子目录，返回该目录下的文件（目前为空）
      const files = getFilesByPrefix(prefix);
      
      return {
        success: true,
        data: {
          files: files,
          directories: [], // 子目录下不再有子目录
        },
      };
    } catch (error: any) {
      console.error('获取文件列表失败:', error);
      return {
        success: false,
        message: error.message || '获取文件列表失败',
      };
    }
  },

  // 获取文件内容 - 使用静态数据
  async fetchFileContent(params: { key: string; etag?: string }): Promise<KnowledgeFileContentResponse> {
    try {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 200));

      // 如果文件内容映射中有该文件，返回真实内容
      if (fileContents[params.key]) {
        return {
          success: true,
          data: {
            content: fileContents[params.key],
          },
        };
      }

      // 否则返回示例内容
      const content = `# ${params.key.split('/').pop() || '文件'}\n\n这是一个示例文件内容。\n\n文件路径：${params.key}`;
      
      return {
        success: true,
        data: {
          content: content,
        },
      };
    } catch (error: any) {
      console.error('获取文件内容失败:', error);
      return {
        success: false,
        message: error.message || '获取文件内容失败',
      };
    }
  },

  // 下载文件 - 使用静态数据
  async downloadFile(key: string, etag?: string): Promise<KnowledgeDownloadResponse> {
    try {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 200));

      // 返回示例下载链接（实际使用时可以替换为真实链接）
      const downloadUrl = `#${key}`;
      
      return {
        success: true,
        data: {
          download_url: downloadUrl,
        },
      };
    } catch (error: any) {
      console.error('下载文件失败:', error);
      return {
        success: false,
        message: error.message || '下载文件失败',
      };
    }
  },
};

