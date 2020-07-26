import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Cliente inexistente');
    }

    const existentProduct = await this.productsRepository.findAllById(products);

    if (!existentProduct.length) {
      throw new AppError('Não foi possivel achar produtos para os IDs');
    }

    const existentProductIds = existentProduct.map(product => product.id);

    const inexistentsProducts = products.filter(
      product => !existentProductIds.includes(product.id),
    );

    if (inexistentsProducts.length) {
      throw new AppError(
        `Não foi possivel achar produtos para os ID: ${inexistentsProducts[0].id}`,
      );
    }

    const findProductWithNoQuantityAvailable = products.filter(
      product =>
        existentProduct.filter(p => p.id === product.id)[0].quantity <=
        product.quantity,
    );

    if (findProductWithNoQuantityAvailable.length) {
      throw new AppError(
        `Não existem quantidades disponiveis para o produto: ${findProductWithNoQuantityAvailable[0].id}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProduct.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    const { order_products } = order;

    const orderedProductQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        existentProduct.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductQuantity);

    return order;
  }
}

export default CreateOrderService;
