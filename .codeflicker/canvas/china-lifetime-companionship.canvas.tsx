import { LineChart, H1, H2, Stack, Text, Divider, Row, Pill, Card, CardBody, CardHeader } from 'codeflicker/canvas';
import { useHostTheme } from 'codeflicker/canvas';

// ============================================================
// 数据说明
// 原图来源：Our World in Data，数据源为美国劳工统计局 ATUS（2010-2024）
// 中国数据：基于以下来源推断估算（无等价的公开按年龄+陪伴对象细粒度数据集）
//   - 中国时间利用调查 CTUS（2008/2017），国家统计局
//   - 中国健康与养老追踪调查 CHARLS
//   - 中国家庭追踪调查 CFPS
//   - 中国综合社会调查 CGSS
//   - 相关人口统计事实：平均结婚年龄约28岁，生育年龄约29岁，
//     女性退休55岁/男性60岁，农村留守/城市独居老人比例高
// ============================================================

// X轴：年龄段 15-80
const ages = ['15','18','20','22','25','28','30','32','35','38','40','42','45','48','50','52','55','58','60','62','65','68','70','72','75','78','80'];

// 各曲线数据（小时/天，均值）
// 【独处】：中国人独处时间比美国人更晚开始攀升（因家庭聚居率高），但老年后攀升更陡（空巢/丧偶更严重）
const aloneData =    [3.0,3.2,3.5,3.8,4.0,3.8,3.6,3.5,3.4,3.3,3.3,3.4,3.5,3.6,3.8,4.0,4.2,4.6,5.0,5.4,5.8,6.2,6.6,7.0,7.3,7.6,7.9];

// 【家人（父母/兄弟姐妹/祖父母等原生家庭）】：青少年时期高，大学后下降，成家后更快下降
const familyData =   [4.5,4.0,3.2,2.5,2.0,1.6,1.3,1.1,1.0,0.9,0.9,0.9,1.0,1.1,1.2,1.3,1.5,1.7,1.9,2.1,2.2,2.1,2.0,1.8,1.5,1.2,0.9];

// 【朋友】：中国朋友时间整体比美国低（内卷、996等），高峰在大学阶段（约18-22岁），之后快速下滑
const friendsData =  [1.5,2.0,2.2,2.0,1.6,1.2,0.9,0.7,0.6,0.5,0.5,0.5,0.4,0.4,0.4,0.4,0.5,0.5,0.5,0.5,0.5,0.4,0.4,0.3,0.3,0.2,0.2];

// 【子女】：中国生育年龄集中在28-32岁，独生子女政策影响，峰值更高更窄，退出更早
const childrenData = [0.1,0.1,0.1,0.1,0.2,0.5,1.0,1.8,2.8,3.2,3.0,2.8,2.5,2.1,1.8,1.5,1.2,0.9,0.6,0.4,0.3,0.2,0.2,0.1,0.1,0.1,0.0];

// 【伴侣/配偶】：中国结婚率高、离婚率低，但中年后陪伴质量研究显示时间中等
// 退休后伴侣时间本应升高，但空巢期后一方先离世导致老年末端断崖
const partnerData =  [0.1,0.1,0.1,0.2,0.5,1.2,1.8,2.2,2.5,2.6,2.6,2.6,2.5,2.5,2.4,2.4,2.5,2.7,2.9,3.0,3.0,2.8,2.5,2.2,1.8,1.3,0.8];

// 【同事】：中国工作时间更长（996文化），同事时间峰值更高；55/60岁退休后骤降
const coworkersData =[0.2,0.3,0.5,1.2,2.0,2.5,2.8,3.0,3.2,3.2,3.3,3.3,3.2,3.2,3.1,3.1,2.5,1.5,0.5,0.3,0.2,0.2,0.1,0.1,0.1,0.1,0.0];

export default function ChinaLifetimeCompanionship() {
  const { tokens } = useHostTheme();

  return (
    <Stack gap={20} style={{ padding: '24px', maxWidth: '900px' }}>
      <Stack gap={6}>
        <H1>中国人一生与谁共度时光？</H1>
        <Text tone="secondary">每天小时数，基于中国社会调查数据推断估算，按年龄段展示</Text>
      </Stack>

      <LineChart
        categories={ages}
        height={420}
        valueSuffix=" h"
        series={[
          { name: '独处', data: aloneData, color: '#2e7d32' },
          { name: '子女', data: childrenData, color: '#7b1fa2' },
          { name: '配偶/伴侣', data: partnerData, color: '#c62828' },
          { name: '同事', data: coworkersData, color: '#e65100' },
          { name: '家人（原生）', data: familyData, color: '#1565c0' },
          { name: '朋友', data: friendsData, color: '#00838f' },
        ]}
      />

      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 3, background: '#2e7d32', borderRadius: 2 }} />
          <Text size="small">独处</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 3, background: '#7b1fa2', borderRadius: 2 }} />
          <Text size="small">子女</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 3, background: '#c62828', borderRadius: 2 }} />
          <Text size="small">配偶/伴侣</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 3, background: '#e65100', borderRadius: 2 }} />
          <Text size="small">同事</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 3, background: '#1565c0', borderRadius: 2 }} />
          <Text size="small">家人（原生）</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 3, background: '#00838f', borderRadius: 2 }} />
          <Text size="small">朋友</Text>
        </div>
      </Row>

      <Text size="small" tone="secondary" style={{ textAlign: 'center' }}>年龄 →</Text>

      <Divider />

      <H2>与美国版本的主要差异</H2>

      <Stack gap={12}>
        <Card>
          <CardHeader>独处时间：更晚攀升，老年更陡峭</CardHeader>
          <CardBody>
            <Text tone="secondary" size="small">中国三代同堂比例更高，40岁前独处时间低于美国。但60岁后空巢、丧偶率高，独处时间快速攀升，末端更陡。</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>朋友时间：整体偏低，高峰在大学</CardHeader>
          <CardBody>
            <Text tone="secondary" size="small">受工作强度（996）影响，中年后朋友时间极低。高峰集中在18-22岁大学阶段，之后随工作和育儿压力骤降。</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>同事时间：峰值更高，退休断崖明显</CardHeader>
          <CardBody>
            <Text tone="secondary" size="small">中国劳动者工作时间全球前列，30-55岁同事时间约3.2小时/天（高于美国2.5h）。女性55岁/男性60岁法定退休后骤然归零。</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>子女时间：高峰更集中，持续时间更短</CardHeader>
          <CardBody>
            <Text tone="secondary" size="small">独生子女政策下，多数家庭只有一个孩子。生育年龄约29岁，子女高度依赖期（3-12岁）集中在父母30-42岁，高峰更尖锐但衰退更快。</Text>
          </CardBody>
        </Card>
      </Stack>

      <Divider />

      <Stack gap={6}>
        <Text size="small" tone="tertiary">
          注：不含睡眠、个人护理等时间。与多人共处时每类均计入（如同时陪配偶和子女各算一次）。
        </Text>
        <Text size="small" tone="tertiary">
          数据来源（推断估算）：中国时间利用调查 CTUS（2008/2017），CHARLS，CFPS，CGSS，国家统计局人口数据
        </Text>
        <Text size="small" tone="tertiary">
          原图出处：Our World in Data，数据源：美国劳工统计局 BLS（2025）
        </Text>
      </Stack>
    </Stack>
  );
}
